import { PermissionGuard } from 'src/modules/permission/guards/permission.guard';
import { UseGuards } from '@nestjs/common';
import {
    Args,
    Resolver,
    Query,
    Mutation,
    ObjectType,
    PartialType,
    Int,
    GraphQLISODateTime,
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
import { UseOrPermissions, UsePermission } from 'src/modules/permission/decorators/permission.decorator';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';

@ObjectType()
class ReportDeleteResponse extends PartialType(Report) {}

@Resolver(() => Report)
@UseGuards(GqlAuthGuard, PermissionGuard)
export class ReportResolver {
    constructor(private readonly reportService: ReportService) {}

    @Query(() => ReportQueryConnection)
    @UseOrPermissions([PermissionEnum.REPORTS_VIEW_DEPARTMENT, PermissionEnum.REPORTS_VIEW_ASSIGNED])
    async reports(@Args({ type: () => ReportQuery }) query: ReportQuery, @CurrentUser() user: User) {
        return this.reportService.getReports(query, user);
    }

    @Query(() => [ShinyApp])
    @UseOrPermissions([PermissionEnum.REPORTS_VIEW_DEPARTMENT, PermissionEnum.REPORTS_VIEW_ASSIGNED])
    async availableShinyApps(): Promise<ShinyApp[]> {
        return this.reportService.getAvailableShinyApps();
    }

    @Query(() => Report, { nullable: true })
    @UseOrPermissions([PermissionEnum.REPORTS_VIEW_DEPARTMENT, PermissionEnum.REPORTS_VIEW_ASSIGNED])
    async getReportForCurrentUser(
        @Args('id', { type: () => Int }) id: number,
        @CurrentUser() currentUser: User,
    ): Promise<Report> {
        return this.reportService.getReportForCurrentUser(id, currentUser);
    }

    @Query(() => ReportEmbed, { nullable: true })
    @UseOrPermissions([PermissionEnum.REPORTS_VIEW_DEPARTMENT, PermissionEnum.REPORTS_VIEW_ASSIGNED])
    async getReportEmbed(
        @Args('id', { type: () => Int }) id: number,
        @Args('patientId', { type: () => Int, nullable: true })
        patientId: number,
        @CurrentUser() currentUser: User,
    ): Promise<ReportEmbed> {
        return this.reportService.getReportEmbed(id, currentUser, patientId);
    }

    @Mutation(() => ReportSession, { nullable: true })
    @UseOrPermissions([PermissionEnum.REPORTS_VIEW_DEPARTMENT, PermissionEnum.REPORTS_VIEW_ASSIGNED])
    async startReportSession(
        @Args('reportId', { type: () => Int }) reportId: number,
        @Args('patientId', { type: () => Int, nullable: true })
        patientId: number,
        @Args('contextType', { type: () => String, nullable: true })
        contextType: string,
        @Args('contextParams', { type: () => String, nullable: true })
        contextParams: string,
        @CurrentUser() currentUser: User,
    ): Promise<ReportSession> {
        return this.reportService.startReportSession(
            reportId,
            currentUser,
            patientId,
            contextType,
            contextParams,
        );
    }

    @Query(() => [ReportSession])
    @UsePermission(PermissionEnum.REPORTS_EDIT_DEPARTMENT)
    async reportSessions(
        @Args('reportId', { type: () => Int, nullable: true })
        reportId?: number,
        @Args('userId', { type: () => Int, nullable: true })
        userId?: number,
        @Args('patientId', { type: () => Int, nullable: true })
        patientId?: number,
        @Args('contextType', { type: () => String, nullable: true })
        contextType?: string,
        @Args('active', { type: () => Boolean, nullable: true })
        active?: boolean,
        @Args('from', { type: () => GraphQLISODateTime, nullable: true })
        from?: Date,
        @Args('to', { type: () => GraphQLISODateTime, nullable: true })
        to?: Date,
        @CurrentUser() currentUser?: User,
    ): Promise<ReportSession[]> {
        return this.reportService.getReportSessions({
            reportId,
            userId,
            patientId,
            contextType,
            active,
            from,
            to,
        }, currentUser);
    }

    @Mutation(() => ReportSession, { nullable: true })
    @UseOrPermissions([PermissionEnum.REPORTS_VIEW_DEPARTMENT, PermissionEnum.REPORTS_VIEW_ASSIGNED])
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
    @UseOrPermissions([PermissionEnum.REPORTS_VIEW_DEPARTMENT, PermissionEnum.REPORTS_VIEW_ASSIGNED])
    async endReportSession(
        @Args('sessionId', { type: () => Int }) sessionId: number,
        @CurrentUser() currentUser: User,
    ): Promise<ReportSession> {
        return this.reportService.endReportSession(sessionId, currentUser);
    }

    @Query(() => [Report])
    @UseOrPermissions([PermissionEnum.REPORTS_VIEW_DEPARTMENT, PermissionEnum.REPORTS_VIEW_ASSIGNED])
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
        @CurrentUser() user: User,
    ): Promise<any> {
        const reportInput = this.extractReportInput(input);
        return this.reportService.insert(reportInput);
    }

    @Mutation(() => Report)
    @UsePermission(PermissionEnum.REPORTS_EDIT_DEPARTMENT)
    async updateOneReport(
        @Args('input', { type: () => UpdateOneReportInput })
        input: UpdateOneReportInput,
    ): Promise<any> {
        return this.reportService.update(this.extractUpdateReportInput(input));
    }

    private extractReportInput(input: CreateOneReportInput | any): ReportInput {
        return input?.report || input?.input?.report || input?.input || input;
    }

    private extractUpdateReportInput(input: UpdateOneReportInput | any): UpdateOneReportInput {
        return input?.id || input?.update ? input : input?.input || input;
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
