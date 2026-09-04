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
    @UseOrPermissions([
        PermissionEnum.CLINICAL_CREATE_ALL,
        PermissionEnum.CLINICAL_CREATE_DEPARTMENT,
        PermissionEnum.CLINICAL_CREATE_ASSIGNED,
    ])
    createClinicalSession(
        @Args('session') input: CreateClinicalSessionInput,
        @CurrentUser() currentUser: User,
    ): Promise<ClinicalSession> {
        return this.schedulingService.createClinicalSession(input, currentUser);
    }

    @Query(() => [ClinicalSession])
    @UseOrPermissions([
        PermissionEnum.CLINICAL_VIEW_ALL,
        PermissionEnum.CLINICAL_VIEW_DEPARTMENT,
        PermissionEnum.CLINICAL_VIEW_ASSIGNED,
    ])
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
    @UseOrPermissions([
        PermissionEnum.CLINICAL_VIEW_ALL,
        PermissionEnum.CLINICAL_VIEW_DEPARTMENT,
        PermissionEnum.CLINICAL_VIEW_ASSIGNED,
    ])
    clinicalSessionSchemeApplications(
        @Args('clinicalSessionId', { type: () => Int }) clinicalSessionId: number,
    ): Promise<ClinicalSessionSchemeApplication[]> {
        return this.schedulingService.getActiveSchemeApplicationsForSession(clinicalSessionId);
    }

    @Query(() => [ClinicalSessionFollowUpVersion])
    @UseOrPermissions([
        PermissionEnum.CLINICAL_VIEW_ALL,
        PermissionEnum.CLINICAL_VIEW_DEPARTMENT,
        PermissionEnum.CLINICAL_VIEW_ASSIGNED,
    ])
    clinicalSessionFollowUpVersions(
        @Args('clinicalSessionId', { type: () => Int }) clinicalSessionId: number,
    ): Promise<ClinicalSessionFollowUpVersion[]> {
        return this.schedulingService.getClinicalSessionFollowUpVersions(clinicalSessionId);
    }

    @Query(() => ClinicalSessionFollowUpSetting)
    @UseOrPermissions([
        PermissionEnum.CLINICAL_VIEW_ALL,
        PermissionEnum.CLINICAL_VIEW_DEPARTMENT,
        PermissionEnum.CLINICAL_VIEW_ASSIGNED,
        PermissionEnum.SETTINGS_VIEW_ALL,
    ])
    clinicalSessionFollowUpSettings(): Promise<ClinicalSessionFollowUpSetting> {
        return this.schedulingService.getClinicalSessionFollowUpSettings();
    }

    @Mutation(() => ClinicalSession)
    @UseOrPermissions([
        PermissionEnum.CLINICAL_EDIT_ALL,
        PermissionEnum.CLINICAL_EDIT_DEPARTMENT,
        PermissionEnum.CLINICAL_EDIT_ASSIGNED,
    ])
    moveClinicalSession(
        @Args('session') input: MoveClinicalSessionInput,
        @CurrentUser() currentUser: User,
    ): Promise<ClinicalSession> {
        return this.schedulingService.moveClinicalSession(input, currentUser);
    }

    @Mutation(() => [ClinicalSession])
    @UseOrPermissions([
        PermissionEnum.CLINICAL_EDIT_ALL,
        PermissionEnum.CLINICAL_EDIT_DEPARTMENT,
        PermissionEnum.CLINICAL_EDIT_ASSIGNED,
    ])
    restructureClinicalSessions(
        @Args('restructure') input: RestructureClinicalSessionsInput,
        @CurrentUser() currentUser: User,
    ): Promise<ClinicalSession[]> {
        return this.schedulingService.restructureClinicalSessions(input, currentUser);
    }

    @Mutation(() => ClinicalSession)
    @UseOrPermissions([
        PermissionEnum.CLINICAL_EDIT_ALL,
        PermissionEnum.CLINICAL_EDIT_DEPARTMENT,
        PermissionEnum.CLINICAL_EDIT_ASSIGNED,
    ])
    updateClinicalSession(
        @Args('session') input: UpdateClinicalSessionInput,
        @CurrentUser() currentUser: User,
    ): Promise<ClinicalSession> {
        return this.schedulingService.updateClinicalSession(input, currentUser);
    }

    @Mutation(() => ClinicalSessionResource)
    @UseOrPermissions([
        PermissionEnum.CLINICAL_EDIT_ALL,
        PermissionEnum.CLINICAL_EDIT_DEPARTMENT,
        PermissionEnum.CLINICAL_EDIT_ASSIGNED,
    ])
    updateClinicalSessionResource(
        @Args('resource') input: UpdateClinicalSessionResourceInput,
        @CurrentUser() currentUser: User,
    ): Promise<ClinicalSessionResource> {
        return this.schedulingService.updateClinicalSessionResource(input, currentUser);
    }

    @Mutation(() => [ClinicalSessionResource])
    @UseOrPermissions([
        PermissionEnum.CLINICAL_EDIT_ALL,
        PermissionEnum.CLINICAL_EDIT_DEPARTMENT,
        PermissionEnum.CLINICAL_EDIT_ASSIGNED,
    ])
    addClinicalSessionSchemes(
        @Args('schemes') input: AddClinicalSessionSchemesInput,
        @CurrentUser() currentUser: User,
    ): Promise<ClinicalSessionResource[]> {
        return this.schedulingService.addClinicalSessionSchemes(input, currentUser);
    }

    @Mutation(() => ClinicalSessionResource)
    @UseOrPermissions([
        PermissionEnum.CLINICAL_EDIT_ALL,
        PermissionEnum.CLINICAL_EDIT_DEPARTMENT,
        PermissionEnum.CLINICAL_EDIT_ASSIGNED,
    ])
    discardClinicalSessionAssessment(
        @Args('assessment') input: DiscardClinicalSessionAssessmentInput,
        @CurrentUser() currentUser: User,
    ): Promise<ClinicalSessionResource> {
        return this.schedulingService.discardClinicalSessionAssessment(input, currentUser);
    }

    @Mutation(() => ClinicalSessionSchemeApplication)
    @UseOrPermissions([
        PermissionEnum.CLINICAL_EDIT_ALL,
        PermissionEnum.CLINICAL_EDIT_DEPARTMENT,
        PermissionEnum.CLINICAL_EDIT_ASSIGNED,
    ])
    stopClinicalSessionScheme(
        @Args('scheme') input: StopClinicalSessionSchemeInput,
        @CurrentUser() currentUser: User,
    ): Promise<ClinicalSessionSchemeApplication> {
        return this.schedulingService.stopClinicalSessionScheme(input, currentUser);
    }

    @Mutation(() => ClinicalSessionFollowUpSetting)
    @UsePermission(PermissionEnum.SETTINGS_EDIT_ALL)
    updateClinicalSessionFollowUpSettings(
        @Args('settings') input: UpdateClinicalSessionFollowUpSettingsInput,
    ): Promise<ClinicalSessionFollowUpSetting> {
        return this.schedulingService.updateClinicalSessionFollowUpSettings(input);
    }

    @Mutation(() => ClinicalSession)
    @UseOrPermissions([
        PermissionEnum.CLINICAL_EDIT_ALL,
        PermissionEnum.CLINICAL_EDIT_DEPARTMENT,
        PermissionEnum.CLINICAL_EDIT_ASSIGNED,
    ])
    cancelClinicalSession(
        @Args('session') input: CancelClinicalSessionInput,
        @CurrentUser() currentUser: User,
    ): Promise<ClinicalSession> {
        return this.schedulingService.cancelClinicalSession(input, currentUser);
    }
}
