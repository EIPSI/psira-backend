import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from 'src/modules/permission/models/role.model';
import { In, Repository } from 'typeorm';
import { ReportInput, UpdateOneReportInput } from '../dtos/report-input';
import { InjectQueryService, QueryService } from '@nestjs-query/core';
import { ConnectionType } from '@nestjs-query/query-graphql';
import { existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

import { Report } from '../models/report.model';
import { ReportEmbed } from '../models/report-embed.model';
import { ReportSession } from '../models/report-session.model';
import { ShinyApp } from '../models/shiny-app.model';
import { ReportQueryConnection } from '../dtos/report-args';
import { User } from 'src/modules/user/models/user.model';
import { jwtConstants } from 'src/modules/auth/constants';

@Injectable()
export class ReportService {
    constructor(
        @InjectRepository(Report)
        private readonly reportRepository: Repository<Report>,
        @InjectRepository(ReportSession)
        private readonly reportSessionRepository: Repository<ReportSession>,
        @InjectRepository(Role)
        private readonly roleRepository: Repository<Role>,
        @InjectQueryService(Report)
        private readonly reportQueryService: QueryService<Report>,
    ) {}

    getReports(query): Promise<ConnectionType<Report>> {
        return ReportQueryConnection.createFromPromise(
            q => this.reportQueryService.query(q),
            query,
            q => this.reportQueryService.count(q),
        );
    }

    getAvailableShinyApps(): ShinyApp[] {
        const shinyAppsDir =
            process.env.SHINY_APPS_DIR ||
            resolve(process.cwd(), '../psira-shiny/shiny_apps');

        if (!existsSync(shinyAppsDir)) return [];

        return readdirSync(shinyAppsDir, { withFileTypes: true })
            .filter(entry => entry.isDirectory())
            .filter(entry => existsSync(join(shinyAppsDir, entry.name, 'app.R')))
            .map(entry => ({
                appName: entry.name,
                title: this.formatAppTitle(entry.name),
                url: `/shiny/${entry.name}`,
            }))
            .sort((a, b) => a.title.localeCompare(b.title));
    }

    async insert(report: ReportInput) {
        const { roles, ...rest } = report;
        const newReport = this.reportRepository.create(rest);

        const findRoles = await this.roleRepository.find({ id: In(roles) });

        newReport.roles = findRoles;

        await this.reportRepository.save(newReport);

        return newReport;
    }

    async update(input: UpdateOneReportInput): Promise<any> {
        const { id, update } = input;
        const { roles, ...rest } = update;
        const report = await this.reportRepository.findOne({
            relations: ['roles'],
            where: { id },
        });

        const findRoles = await this.roleRepository.find({
            id: In(roles),
        });

        if (findRoles.length !== roles.length)
            throw new NotFoundException('Role not found!');

        report.roles = findRoles;

        return await this.reportRepository.save({
            id,
            ...report,
            ...rest,
        });
    }

    delete(input: any) {
        return this.reportRepository.softDelete({ id: input.id });
    }

    async getReportsByResource(
        resource: string,
        currentUser: User,
    ): Promise<Report[]> {
        const user = await User.findOne({
            relations: ['roles'],
            where: { id: currentUser.id },
        });

        const userRoleIds = user.roles.map(role => role.id);

        const reports = await this.reportRepository
            .createQueryBuilder('report')
            .innerJoin('report.roles', 'roles')
            .where('report.resources = :resources', { resources: resource })
            .andWhere('report.status = :status', { status: true })
            .andWhere('roles.id IN (:...roleId)', {
                roleId: userRoleIds,
            })
            .getMany();

        return reports;
    }

    async getReportForCurrentUser(
        id: number,
        currentUser: User,
    ): Promise<Report> {
        const user = await User.findOne({
            relations: ['roles'],
            where: { id: currentUser.id },
        });

        const userRoleIds = user.roles.map(role => role.id);

        return this.reportRepository
            .createQueryBuilder('report')
            .innerJoin('report.roles', 'roles')
            .where('report.id = :id', { id })
            .andWhere('report.status = :status', { status: true })
            .andWhere('roles.id IN (:...roleId)', {
                roleId: userRoleIds,
            })
            .getOne();
    }

    async getReportEmbed(
        id: number,
        currentUser: User,
        patientId?: number,
    ): Promise<ReportEmbed> {
        const report = await this.getReportForCurrentUser(id, currentUser);
        if (!report) return null;

        const expiresAt = new Date(Date.now() + this.getEmbedTokenTtl() * 1000);
        const embedToken = this.createEmbedToken({
            reportId: report.id,
            userId: currentUser.id,
            patientId,
            expiresAt,
        });

        return {
            report,
            embedUrl: this.appendQueryParams(this.getReportEmbedUrl(report, embedToken), {
                embed_token: embedToken,
                ...(patientId ? { patient_id: patientId } : {}),
            }),
            expiresAt,
        };
    }

    validateEmbedToken(token: string): boolean {
        try {
            const [payloadPart, signature] = token.split('.');
            if (!payloadPart || !signature) return false;

            const expectedSignature = this.sign(payloadPart);
            if (!this.secureCompare(signature, expectedSignature)) return false;

            const payload = JSON.parse(
                Buffer.from(this.base64UrlToBase64(payloadPart), 'base64').toString(
                    'utf8',
                ),
            );

            if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
                return false;
            }

            return true;
        } catch (e) {
            return false;
        }
    }

    async startReportSession(
        reportId: number,
        currentUser: User,
        patientId?: number,
    ): Promise<ReportSession> {
        const report = await this.getReportForCurrentUser(reportId, currentUser);
        if (!report) return null;

        const now = new Date();
        const session = this.reportSessionRepository.create({
            reportId,
            userId: currentUser.id,
            patientId,
            startedAt: now,
            lastSeenAt: now,
            active: true,
            durationSeconds: 0,
        });

        return this.reportSessionRepository.save(session);
    }

    async getReportSessions(): Promise<ReportSession[]> {
        return this.reportSessionRepository.find({
            relations: ['report'],
            order: {
                startedAt: 'DESC',
            },
            take: Number(process.env.REPORT_SESSION_QUERY_LIMIT || 5000),
        });
    }

    async heartbeatReportSession(
        sessionId: number,
        currentUser: User,
    ): Promise<ReportSession> {
        const session = await this.reportSessionRepository.findOne({
            where: {
                id: sessionId,
                userId: currentUser.id,
            },
        });

        if (!session) return null;

        session.lastSeenAt = new Date();
        session.durationSeconds = this.calculateDurationSeconds(session);

        return this.reportSessionRepository.save(session);
    }

    async endReportSession(
        sessionId: number,
        currentUser: User,
    ): Promise<ReportSession> {
        const session = await this.reportSessionRepository.findOne({
            where: {
                id: sessionId,
                userId: currentUser.id,
            },
        });

        if (!session) return null;

        const now = new Date();
        session.lastSeenAt = now;
        session.endedAt = now;
        session.active = false;
        session.durationSeconds = this.calculateDurationSeconds(session);

        return this.reportSessionRepository.save(session);
    }

    private formatAppTitle(appName: string): string {
        return appName
            .split(/[-_]/)
            .filter(Boolean)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }

    private calculateDurationSeconds(session: ReportSession): number {
        const end = session.endedAt || session.lastSeenAt || new Date();
        return Math.max(
            0,
            Math.floor((end.getTime() - session.startedAt.getTime()) / 1000),
        );
    }

    private getReportUrl(report: Report): string {
        let url = report.url || (report.appName ? `/shiny/${report.appName}` : '');
        if (!/^https?:\/\//i.test(url) && url.indexOf('/') !== 0) {
            url = '/' + url;
        }
        return url;
    }

    private getReportEmbedUrl(report: Report, token: string): string {
        if (!report.appName) {
            return this.appendQueryParams(this.getReportUrl(report), {
                embed_token: token,
            });
        }

        return `/shiny-embed/${encodeURIComponent(token)}/${report.appName}/`;
    }

    private appendQueryParams(
        url: string,
        params: Record<string, string | number>,
    ): string {
        const query = Object.entries(params)
            .filter(([, value]) => value !== undefined && value !== null)
            .map(
                ([key, value]) =>
                    `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
            )
            .join('&');

        if (!query) return url;

        return `${url}${url.includes('?') ? '&' : '?'}${query}`;
    }

    private createEmbedToken(input: {
        reportId: number;
        userId: number;
        patientId?: number;
        expiresAt: Date;
    }): string {
        const payload = {
            reportId: input.reportId,
            userId: input.userId,
            patientId: input.patientId,
            exp: Math.floor(input.expiresAt.getTime() / 1000),
            nonce: randomBytes(12).toString('hex'),
        };

        const payloadPart = this.base64UrlEncode(JSON.stringify(payload));
        const signature = this.sign(payloadPart);

        return `${payloadPart}.${signature}`;
    }

    private sign(value: string): string {
        return this.base64UrlEncode(
            createHmac('sha256', this.getEmbedSecret())
                .update(value)
                .digest(),
        );
    }

    private getEmbedTokenTtl(): number {
        return Number(process.env.REPORT_EMBED_TOKEN_TTL || 5 * 60);
    }

    private getEmbedSecret(): string {
        return (
            process.env.REPORT_EMBED_SECRET ||
            process.env.SECRET ||
            jwtConstants.secret
        );
    }

    private base64UrlEncode(value: string | Buffer): string {
        return Buffer.from(value)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/g, '');
    }

    private base64UrlToBase64(value: string): string {
        const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
        const padding = (4 - (base64.length % 4)) % 4;
        return `${base64}${'='.repeat(padding)}`;
    }

    private secureCompare(a: string, b: string): boolean {
        const left = Buffer.from(a);
        const right = Buffer.from(b);

        if (left.length !== right.length) return false;

        return timingSafeEqual(left, right);
    }
}
