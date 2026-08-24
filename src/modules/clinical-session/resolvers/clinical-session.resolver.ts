import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from 'src/modules/auth/auth-user.decorator';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import {
    UseOrPermissions,
    UsePermission,
} from 'src/modules/permission/decorators/permission.decorator';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { PermissionGuard } from 'src/modules/permission/guards/permission.guard';
import { User } from 'src/modules/user/models/user.model';
import {
    AddClinicalSessionSchemesInput,
    CancelClinicalSessionInput,
    ClinicalSessionListFilterInput,
    CreateClinicalSessionInput,
    DiscardClinicalSessionAssessmentInput,
    MoveClinicalSessionInput,
    RestructureClinicalSessionsInput,
    StopClinicalSessionSchemeInput,
    UpdateClinicalSessionFollowUpSettingsInput,
    UpdateClinicalSessionResourceInput,
    UpdateClinicalSessionInput,
} from '../dtos/clinical-session.input';
import { ClinicalSessionFollowUpSetting } from '../models/clinical-session-follow-up-setting.model';
import { ClinicalSessionFollowUpVersion } from '../models/clinical-session-follow-up-version.model';
import { ClinicalSessionResource } from '../models/clinical-session-resource.model';
import { ClinicalSessionSchemeApplication } from '../models/clinical-session-scheme-application.model';
import { ClinicalSession } from '../models/clinical-session.model';
import { ClinicalSessionSchedulingService } from '../services/clinical-session-scheduling.service';

@Resolver(() => ClinicalSession)
@UseGuards(GqlAuthGuard, PermissionGuard)
export class ClinicalSessionResolver {
    constructor(
        private readonly schedulingService: ClinicalSessionSchedulingService,
    ) {}

    @Mutation(() => ClinicalSession)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    createClinicalSession(
        @Args('session') input: CreateClinicalSessionInput,
        @CurrentUser() currentUser: User,
    ): Promise<ClinicalSession> {
        return this.schedulingService.createClinicalSession(input, currentUser);
    }

    @Query(() => [ClinicalSession])
    @UsePermission(PermissionEnum.VIEW_ASSESSMENTS)
    clinicalSessions(
        @Args('filter', {
            type: () => ClinicalSessionListFilterInput,
            nullable: true,
        })
        filter: ClinicalSessionListFilterInput,
    ): Promise<ClinicalSession[]> {
        return this.schedulingService.getClinicalSessions(filter || {});
    }

    @Query(() => [ClinicalSessionSchemeApplication])
    @UsePermission(PermissionEnum.VIEW_ASSESSMENTS)
    clinicalSessionSchemeApplications(
        @Args('clinicalSessionId', { type: () => Int }) clinicalSessionId: number,
    ): Promise<ClinicalSessionSchemeApplication[]> {
        return this.schedulingService.getActiveSchemeApplicationsForSession(clinicalSessionId);
    }

    @Query(() => [ClinicalSessionFollowUpVersion])
    @UsePermission(PermissionEnum.VIEW_ASSESSMENTS)
    clinicalSessionFollowUpVersions(
        @Args('clinicalSessionId', { type: () => Int }) clinicalSessionId: number,
    ): Promise<ClinicalSessionFollowUpVersion[]> {
        return this.schedulingService.getClinicalSessionFollowUpVersions(clinicalSessionId);
    }

    @Query(() => ClinicalSessionFollowUpSetting)
    @UseOrPermissions([PermissionEnum.VIEW_ASSESSMENTS, PermissionEnum.VIEW_SETTINGS])
    clinicalSessionFollowUpSettings(): Promise<ClinicalSessionFollowUpSetting> {
        return this.schedulingService.getClinicalSessionFollowUpSettings();
    }

    @Mutation(() => ClinicalSession)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    moveClinicalSession(
        @Args('session') input: MoveClinicalSessionInput,
        @CurrentUser() currentUser: User,
    ): Promise<ClinicalSession> {
        return this.schedulingService.moveClinicalSession(input, currentUser);
    }

    @Mutation(() => [ClinicalSession])
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    restructureClinicalSessions(
        @Args('restructure') input: RestructureClinicalSessionsInput,
        @CurrentUser() currentUser: User,
    ): Promise<ClinicalSession[]> {
        return this.schedulingService.restructureClinicalSessions(input, currentUser);
    }

    @Mutation(() => ClinicalSession)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    updateClinicalSession(
        @Args('session') input: UpdateClinicalSessionInput,
        @CurrentUser() currentUser: User,
    ): Promise<ClinicalSession> {
        return this.schedulingService.updateClinicalSession(input, currentUser);
    }

    @Mutation(() => ClinicalSessionResource)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    updateClinicalSessionResource(
        @Args('resource') input: UpdateClinicalSessionResourceInput,
        @CurrentUser() currentUser: User,
    ): Promise<ClinicalSessionResource> {
        return this.schedulingService.updateClinicalSessionResource(input, currentUser);
    }

    @Mutation(() => [ClinicalSessionResource])
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    addClinicalSessionSchemes(
        @Args('schemes') input: AddClinicalSessionSchemesInput,
        @CurrentUser() currentUser: User,
    ): Promise<ClinicalSessionResource[]> {
        return this.schedulingService.addClinicalSessionSchemes(input, currentUser);
    }

    @Mutation(() => ClinicalSessionResource)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    discardClinicalSessionAssessment(
        @Args('assessment') input: DiscardClinicalSessionAssessmentInput,
        @CurrentUser() currentUser: User,
    ): Promise<ClinicalSessionResource> {
        return this.schedulingService.discardClinicalSessionAssessment(input, currentUser);
    }

    @Mutation(() => ClinicalSessionSchemeApplication)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    stopClinicalSessionScheme(
        @Args('scheme') input: StopClinicalSessionSchemeInput,
        @CurrentUser() currentUser: User,
    ): Promise<ClinicalSessionSchemeApplication> {
        return this.schedulingService.stopClinicalSessionScheme(input, currentUser);
    }

    @Mutation(() => ClinicalSessionFollowUpSetting)
    @UsePermission(PermissionEnum.MANAGE_SETTINGS)
    updateClinicalSessionFollowUpSettings(
        @Args('settings') input: UpdateClinicalSessionFollowUpSettingsInput,
    ): Promise<ClinicalSessionFollowUpSetting> {
        return this.schedulingService.updateClinicalSessionFollowUpSettings(input);
    }

    @Mutation(() => ClinicalSession)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    cancelClinicalSession(
        @Args('session') input: CancelClinicalSessionInput,
        @CurrentUser() currentUser: User,
    ): Promise<ClinicalSession> {
        return this.schedulingService.cancelClinicalSession(input, currentUser);
    }
}
