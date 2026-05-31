import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from 'src/modules/auth/auth-user.decorator';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import { UsePermission } from 'src/modules/permission/decorators/permission.decorator';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { PermissionGuard } from 'src/modules/permission/guards/permission.guard';
import { User } from 'src/modules/user/models/user.model';
import {
    CancelClinicalSessionInput,
    ClinicalSessionListFilterInput,
    CreateClinicalSessionInput,
    MoveClinicalSessionInput,
    UpdateClinicalSessionInput,
} from '../dtos/clinical-session.input';
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

    @Mutation(() => ClinicalSession)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    moveClinicalSession(
        @Args('session') input: MoveClinicalSessionInput,
        @CurrentUser() currentUser: User,
    ): Promise<ClinicalSession> {
        return this.schedulingService.moveClinicalSession(input, currentUser);
    }

    @Mutation(() => ClinicalSession)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    updateClinicalSession(
        @Args('session') input: UpdateClinicalSessionInput,
        @CurrentUser() currentUser: User,
    ): Promise<ClinicalSession> {
        return this.schedulingService.updateClinicalSession(input, currentUser);
    }

    @Mutation(() => ClinicalSession)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    cancelClinicalSession(
        @Args('session') input: CancelClinicalSessionInput,
    ): Promise<ClinicalSession> {
        return this.schedulingService.cancelClinicalSession(input);
    }
}
