/* eslint-disable @typescript-eslint/camelcase */
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Assessment } from 'src/modules/assessment/models/assessment.model';
import { configService } from 'src/config/config.service';
import { ClinicalSessionResourceStatus } from 'src/modules/clinical-session/enums/clinical-session-resource-status.enum';
import { ClinicalSessionResource } from 'src/modules/clinical-session/models/clinical-session-resource.model';
import { ClinicalSession } from 'src/modules/clinical-session/models/clinical-session.model';
import { ResourceActivationAnchor } from 'src/modules/evaluation-scheme/enums/resource-activation-anchor.enum';
import { AssessmentStatus } from 'src/modules/questionnaire/enums/assessment-status.enum';
import { SettingService } from 'src/modules/setting/providers/setting.service';
import { User } from 'src/modules/user/models/user.model';
import { In, Repository } from 'typeorm';
import { CalendarOccurrenceStatus } from '../enums/calendar-occurrence-status.enum';
import { CalendarExternalEvent } from '../models/calendar-external-event.model';
import { CalendarOccurrence } from '../models/calendar-occurrence.model';
import { GoogleCalendarConnection } from '../models/google-calendar-connection.model';
import { GoogleCalendarHttpService } from './google-calendar-http.service';
import * as CryptoJS from 'crypto-js';

interface GoogleTokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
}

interface GoogleEventResponse {
    id: string;
    updated?: string;
    start?: { dateTime?: string };
    end?: { dateTime?: string };
}

interface GoogleCalendarConfig {
    enabled: boolean;
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
}

@Injectable()
export class GoogleCalendarSyncService {
    private readonly scopes = [
        'https://www.googleapis.com/auth/calendar.events',
    ];

    constructor(
        @InjectRepository(CalendarOccurrence)
        private readonly occurrenceRepository: Repository<CalendarOccurrence>,
        @InjectRepository(CalendarExternalEvent)
        private readonly externalEventRepository: Repository<CalendarExternalEvent>,
        @InjectRepository(GoogleCalendarConnection)
        private readonly connectionRepository: Repository<GoogleCalendarConnection>,
        @InjectRepository(ClinicalSession)
        private readonly clinicalSessionRepository: Repository<ClinicalSession>,
        @InjectRepository(ClinicalSessionResource)
        private readonly resourceRepository: Repository<ClinicalSessionResource>,
        @InjectRepository(Assessment)
        private readonly assessmentRepository: Repository<Assessment>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly googleHttp: GoogleCalendarHttpService,
        private readonly settingService: SettingService,
    ) {}

    async isConfigured(): Promise<boolean> {
        const googleConfig = await this.getGoogleConfig();
        return this.hasCompleteConfig(googleConfig);
    }

    async getAuthorizationUrl(user: User): Promise<string> {
        const googleConfig = await this.ensureGoogleConfig();
        const params = new URLSearchParams({
            client_id: googleConfig.clientId,
            redirect_uri: googleConfig.redirectUri,
            response_type: 'code',
            access_type: 'offline',
            prompt: 'consent',
            scope: this.scopes.join(' '),
            state: String(user.id),
        });
        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    async connectUser(code: string, user: User): Promise<GoogleCalendarConnection> {
        const googleConfig = await this.ensureGoogleConfig();
        const token = await this.googleHttp.postForm<GoogleTokenResponse>(
            'https://oauth2.googleapis.com/token',
            {
                code,
                client_id: googleConfig.clientId,
                client_secret: googleConfig.clientSecret,
                redirect_uri: googleConfig.redirectUri,
                grant_type: 'authorization_code',
            },
        );

        const existing = await this.connectionRepository.findOne({
            where: { userId: user.id, calendarId: 'primary' },
        });
        return this.connectionRepository.save(
            this.connectionRepository.create({
                ...existing,
                userId: user.id,
                calendarId: 'primary',
                accessToken: token.access_token,
                refreshToken: token.refresh_token || existing?.refreshToken,
                tokenExpiresAt: token.expires_in
                    ? new Date(Date.now() + token.expires_in * 1000)
                    : undefined,
                syncEnabled: true,
            }),
        );
    }

    async syncOccurrence(occurrenceId: number): Promise<void> {
        if (!(await this.isConfigured())) return;

        const occurrence = await this.occurrenceRepository.findOne(occurrenceId, {
            relations: ['patient', 'therapist', 'supervisor', 'assessments'],
        });
        if (!occurrence) return;

        const userIds = await this.getLinkedUserIds(occurrence);
        if (!userIds.length) return;

        const connections = await this.connectionRepository.find({
            where: {
                userId: In(userIds),
                syncEnabled: true,
            },
        });

        for (const connection of connections) {
            try {
                await this.upsertExternalEvent(occurrence, connection);
            } catch (error) {
                // External sync should not block clinical scheduling.
            }
        }
    }

    async pullExternalDateChange(externalEventId: string): Promise<CalendarOccurrence | null> {
        await this.ensureGoogleConfig();

        const externalEvent = await this.externalEventRepository.findOne({
            where: { externalEventId, provider: 'GOOGLE' },
        });
        if (!externalEvent) return null;

        const connection = await this.connectionRepository.findOne({
            where: { userId: externalEvent.userId, syncEnabled: true },
        });
        if (!connection) return null;

        const token = await this.ensureAccessToken(connection);
        const googleEvent = await this.googleHttp.getJson<GoogleEventResponse>(
            this.eventUrl(connection.calendarId, externalEvent.externalEventId),
            token,
        );

        if (!googleEvent.start?.dateTime || !googleEvent.end?.dateTime) {
            return null;
        }

        const occurrence = await this.occurrenceRepository.findOne(
            externalEvent.occurrenceId,
        );
        if (!occurrence) return null;

        occurrence.startAt = new Date(googleEvent.start.dateTime);
        occurrence.endAt = new Date(googleEvent.end.dateTime);
        occurrence.isDetachedFromTemplate = true;
        await this.occurrenceRepository.save(occurrence);
        await this.reschedulePendingSessionResources(occurrence);

        externalEvent.externalUpdatedAt = googleEvent.updated
            ? new Date(googleEvent.updated)
            : new Date();
        externalEvent.lastSyncedAt = new Date();
        await this.externalEventRepository.save(externalEvent);

        return occurrence;
    }

    private async reschedulePendingSessionResources(
        occurrence: CalendarOccurrence,
    ): Promise<void> {
        const session = await this.clinicalSessionRepository.findOne({
            where: { calendarOccurrenceId: occurrence.id },
            relations: ['resources', 'resources.assessment'],
        });
        if (!session) return;

        for (const resource of session.resources || []) {
            if (
                [
                    ClinicalSessionResourceStatus.CANCELLED,
                    ClinicalSessionResourceStatus.DETACHED,
                ].includes(resource.status)
            ) {
                continue;
            }
            const assessment = resource.assessment;
            if (!assessment || this.isAssessmentAnswered(assessment)) continue;

            const timing = this.calculateResourceWindow(
                occurrence.startAt,
                occurrence.endAt,
                resource,
            );
            resource.activationAt = timing.activationAt;
            resource.expirationAt = timing.expirationAt;
            await this.resourceRepository.save(resource);

            assessment.deliveryDate = timing.activationAt;
            assessment.expirationDate = timing.expirationAt;
            await this.assessmentRepository.save(assessment);
        }
    }

    private calculateResourceWindow(
        sessionStartAt: Date,
        sessionEndAt: Date,
        resource: ClinicalSessionResource,
    ): { activationAt: Date; expirationAt: Date } {
        const anchor =
            resource.activationAnchor || ResourceActivationAnchor.SESSION_START;
        const anchorDate =
            anchor === ResourceActivationAnchor.SESSION_END
                ? new Date(sessionEndAt)
                : new Date(sessionStartAt);
        const activationAt = new Date(
            anchorDate.getTime() + (resource.activationOffsetMinutes || 0) * 60000,
        );
        const expirationAt = new Date(
            activationAt.getTime() +
                (resource.availabilityDurationMinutes || 60) * 60000,
        );
        return { activationAt, expirationAt };
    }

    private isAssessmentAnswered(assessment: Assessment): boolean {
        return (
            !!assessment.submissionDate ||
            [
                AssessmentStatus.COMPLETED,
                AssessmentStatus.PARTIALLY_COMPLETED,
            ].includes(assessment.status as AssessmentStatus)
        );
    }

    private async upsertExternalEvent(
        occurrence: CalendarOccurrence,
        connection: GoogleCalendarConnection,
    ): Promise<void> {
        const token = await this.ensureAccessToken(connection);
        const existing = await this.externalEventRepository.findOne({
            where: {
                occurrenceId: occurrence.id,
                userId: connection.userId,
                provider: 'GOOGLE',
            },
        });
        const eventBody = this.buildGoogleEventBody(occurrence);
        const googleEvent = existing
            ? await this.googleHttp.patchJson<GoogleEventResponse>(
                  this.eventUrl(connection.calendarId, existing.externalEventId),
                  eventBody,
                  token,
              )
            : await this.googleHttp.postJson<GoogleEventResponse>(
                  this.eventsUrl(connection.calendarId),
                  eventBody,
                  token,
              );

        await this.externalEventRepository.save(
            this.externalEventRepository.create({
                ...existing,
                occurrenceId: occurrence.id,
                userId: connection.userId,
                provider: 'GOOGLE',
                externalEventId: googleEvent.id,
                externalUpdatedAt: googleEvent.updated
                    ? new Date(googleEvent.updated)
                    : undefined,
                lastSyncedAt: new Date(),
            }),
        );
    }

    private buildGoogleEventBody(occurrence: CalendarOccurrence) {
        return {
            summary: occurrence.title || 'PSIRA',
            description: this.buildDescription(occurrence),
            start: {
                dateTime: new Date(occurrence.startAt).toISOString(),
                timeZone: occurrence.timezone || 'UTC',
            },
            end: {
                dateTime: new Date(occurrence.endAt).toISOString(),
                timeZone: occurrence.timezone || 'UTC',
            },
            status:
                occurrence.status === CalendarOccurrenceStatus.CANCELLED
                    ? 'cancelled'
                    : 'confirmed',
            extendedProperties: {
                private: {
                    psiraOccurrenceId: String(occurrence.id),
                },
            },
        };
    }

    private buildDescription(occurrence: CalendarOccurrence): string {
        const appUrl = configService.getAppUrl().replace(/\/$/, '');
        const assessments = occurrence.assessments || [];
        if (!assessments.length) {
            return `${appUrl}/psira/calendar`;
        }
        return assessments
            .map((assessment: Assessment) => {
                const encryptedUuid = CryptoJS.AES.encrypt(
                    assessment.uuid,
                    configService.getFrontendEncryptionKey(),
                ).toString();
                const link = `${appUrl}/assessment/overview?assessment=${encodeURIComponent(encryptedUuid)}`;
                const delivery = assessment.deliveryDate
                    ? new Date(assessment.deliveryDate).toISOString()
                    : 'sin inicio';
                const expiration = assessment.expirationDate
                    ? new Date(assessment.expirationDate).toISOString()
                    : 'sin vencimiento';
                return `${link}\nHabilita: ${delivery}\nExpira: ${expiration}`;
            })
            .join('\n\n');
    }

    private async getLinkedUserIds(occurrence: CalendarOccurrence): Promise<number[]> {
        const userIds = [
            occurrence.therapistId,
            occurrence.supervisorId,
            ...((occurrence.assessments || []).flatMap(assessment => [
                assessment.responderUserId,
                assessment.clinicianId,
            ])),
        ].filter((id): id is number => !!id);

        if (occurrence.patient?.userId) {
            userIds.push(occurrence.patient.userId);
        }

        if (!userIds.length) return [];
        const users = await this.userRepository.findByIds([...new Set(userIds)]);
        return users.filter(user => user.active).map(user => user.id);
    }

    private async ensureAccessToken(
        connection: GoogleCalendarConnection,
    ): Promise<string> {
        if (
            connection.tokenExpiresAt &&
            connection.tokenExpiresAt.getTime() > Date.now() + 60 * 1000
        ) {
            return connection.accessToken;
        }
        if (!connection.refreshToken) return connection.accessToken;

        const googleConfig = await this.ensureGoogleConfig();
        const token = await this.googleHttp.postForm<GoogleTokenResponse>(
            'https://oauth2.googleapis.com/token',
            {
                client_id: googleConfig.clientId,
                client_secret: googleConfig.clientSecret,
                refresh_token: connection.refreshToken,
                grant_type: 'refresh_token',
            },
        );

        connection.accessToken = token.access_token;
        connection.tokenExpiresAt = token.expires_in
            ? new Date(Date.now() + token.expires_in * 1000)
            : undefined;
        await this.connectionRepository.save(connection);
        return connection.accessToken;
    }

    private async ensureGoogleConfig(): Promise<GoogleCalendarConfig> {
        const googleConfig = await this.getGoogleConfig();
        if (!this.hasCompleteConfig(googleConfig)) {
            throw new BadRequestException('Google Calendar is not configured');
        }
        return googleConfig;
    }

    private hasCompleteConfig(googleConfig: GoogleCalendarConfig): boolean {
        return !!(
            googleConfig.enabled &&
            googleConfig.clientId &&
            googleConfig.clientSecret &&
            googleConfig.redirectUri
        );
    }

    private async getGoogleConfig(): Promise<GoogleCalendarConfig> {
        const [
            settingEnabled,
            settingClientId,
            settingClientSecret,
            settingRedirectUri,
        ] = await Promise.all([
            this.settingService.getKey('googleCalendarEnabled'),
            this.settingService.getKey('googleCalendarClientId'),
            this.settingService.getKey('googleCalendarClientSecret'),
            this.settingService.getKey('googleCalendarRedirectUri'),
        ]);

        return {
            enabled:
                !!settingEnabled ||
                !!(
                    configService.getGoogleClientId(false) &&
                    configService.getGoogleClientSecret(false) &&
                    configService.getGoogleRedirectUri(false)
                ),
            clientId: settingClientId || configService.getGoogleClientId(false),
            clientSecret:
                settingClientSecret || configService.getGoogleClientSecret(false),
            redirectUri:
                settingRedirectUri || configService.getGoogleRedirectUri(false),
        };
    }

    private eventsUrl(calendarId: string): string {
        return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    }

    private eventUrl(calendarId: string, eventId: string): string {
        return `${this.eventsUrl(calendarId)}/${encodeURIComponent(eventId)}`;
    }
}
