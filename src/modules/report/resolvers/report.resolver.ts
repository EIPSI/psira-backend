import { UseGuards } from '@nestjs/common';
import {
    Args,
    Resolver,
    Query,
    Mutation,
    ObjectType,
    PartialType,
    Int,
} from '@nestjs/graphql';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';

import { Report } from '../models/report.model';
import { ReportEmbed } from '../models/report-embed.model';
import { ReportSession } from '../models/report-session.model';
import { ShinyApp } from '../models/shiny-app.model';

import { ReportService } from '../services/report.service';
import {
    CreateOneReportInput,
    DeleteOneReportInput,
    ReportInput,
    UpdateOneReportInput,
} from '../dtos/report-input';
import { ReportQuery, ReportQueryConnection } from '../dtos/report-args';
import { CurrentUser } from 'src/modules/auth/auth-user.decorator';
import { User } from 'src/modules/user/models/user.model';
import { UsePermission } from 'src/modules/permission/decorators/permission.decorator';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';

@ObjectType()
class ReportDeleteResponse extends PartialType(Report) {}

@Resolver(() => Report)
@UseGuards(GqlAuthGuard)
export class ReportResolver {
    constructor(private readonly reportService: ReportService) {}

    @Query(() => ReportQueryConnection)
    @UsePermission(PermissionEnum.REPORTS_VIEW_DEPARTMENT)
    async reports(@Args({ type: () => ReportQuery }) query: ReportQuery) {
        return this.reportService.getReports(query);
    }

    @Query(() => [ShinyApp])
    @UsePermission(PermissionEnum.REPORTS_VIEW_DEPARTMENT)
    async availableShinyApps(): Promise<ShinyApp[]> {
        return this.reportService.getAvailableShinyApps();
    }

    @Query(() => Report, { nullable: true })
    @UsePermission(PermissionEnum.REPORTS_VIEW_DEPARTMENT)
    async getReportForCurrentUser(
        @Args('id', { type: () => Int }) id: number,
        @CurrentUser() currentUser: User,
    ): Promise<Report> {
        return this.reportService.getReportForCurrentUser(id, currentUser);
    }

    @Query(() => ReportEmbed, { nullable: true })
    @UsePermission(PermissionEnum.REPORTS_VIEW_DEPARTMENT)
    async getReportEmbed(
        @Args('id', { type: () => Int }) id: number,
        @Args('patientId', { type: () => Int, nullable: true })
        patientId: number,
        @CurrentUser() currentUser: User,
    ): Promise<ReportEmbed> {
        return this.reportService.getReportEmbed(id, currentUser, patientId);
    }

    @Mutation(() => ReportSession, { nullable: true })
    @UsePermission(PermissionEnum.REPORTS_VIEW_DEPARTMENT)
    async startReportSession(
        @Args('reportId', { type: () => Int }) reportId: number,
        @Args('patientId', { type: () => Int, nullable: true })
        patientId: number,
        @CurrentUser() currentUser: User,
    ): Promise<ReportSession> {
        return this.reportService.startReportSession(
            reportId,
            currentUser,
            patientId,
        );
    }

    @Query(() => [ReportSession])
    @UsePermission(PermissionEnum.REPORTS_EDIT_DEPARTMENT)
    async reportSessions(): Promise<ReportSession[]> {
        return this.reportService.getReportSessions();
    }

    @Mutation(() => ReportSession, { nullable: true })
    @UsePermission(PermissionEnum.REPORTS_VIEW_DEPARTMENT)
    async heartbeatReportSession(
        @Args('sessionId', { type: () => Int }) sessionId: number,
        @CurrentUser() currentUser: User,
    ): Promise<ReportSession> {
        return this.reportService.heartbeatReportSession(
            sessionId,
            currentUser,
        );
    }

    @Mutation(() => ReportSession, { nullable: true })
    @UsePermission(PermissionEnum.REPORTS_VIEW_DEPARTMENT)
    async endReportSession(
        @Args('sessionId', { type: () => Int }) sessionId: number,
        @CurrentUser() currentUser: User,
    ): Promise<ReportSession> {
        return this.reportService.endReportSession(sessionId, currentUser);
    }

    @Query(() => [Report])
    @UsePermission(PermissionEnum.REPORTS_VIEW_DEPARTMENT)
    async getReportsByResource(
        @Args('resource', { type: () => String }) resource: string,
        @CurrentUser() currentUser: User,
    ): Promise<any> {
        return await this.reportService.getReportsByResource(
            resource,
            currentUser,
        );
    }

    @Mutation(() => Report)
    @UsePermission(PermissionEnum.REPORTS_EDIT_DEPARTMENT)
    async createOneReport(
        @Args('input', { type: () => CreateOneReportInput })
        input: CreateOneReportInput,
    ): Promise<any> {
        const caregiverInput = input['report'] as ReportInput;
        return this.reportService.insert(caregiverInput);
    }

    @Mutation(() => Report)
    @UsePermission(PermissionEnum.REPORTS_EDIT_DEPARTMENT)
    async updateOneReport(
        @Args('input', { type: () => UpdateOneReportInput })
        input: UpdateOneReportInput,
    ): Promise<any> {
        return this.reportService.update(input);
    }

    @Mutation(() => ReportDeleteResponse)
    @UsePermission(PermissionEnum.REPORTS_DELETE_DEPARTMENT)
    async deleteReport(
        @Args('input', { type: () => DeleteOneReportInput })
        input: DeleteOneReportInput,
    ): Promise<any> {
        return this.reportService.delete(input);
    }
}
