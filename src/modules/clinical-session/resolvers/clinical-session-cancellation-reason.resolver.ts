import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import { UsePermission } from 'src/modules/permission/decorators/permission.decorator';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { PermissionGuard } from 'src/modules/permission/guards/permission.guard';
import {
    CreateClinicalSessionCancellationReasonInput,
    UpdateClinicalSessionCancellationReasonInput,
} from '../dtos/clinical-session-cancellation-reason.input';
import { ClinicalSessionCancellationReason } from '../models/clinical-session-cancellation-reason.model';
import { ClinicalSessionCancellationReasonService } from '../services/clinical-session-cancellation-reason.service';

@Resolver(() => ClinicalSessionCancellationReason)
@UseGuards(GqlAuthGuard, PermissionGuard)
export class ClinicalSessionCancellationReasonResolver {
    constructor(
        private readonly reasonService: ClinicalSessionCancellationReasonService,
    ) {}

    @Query(() => [ClinicalSessionCancellationReason])
    @UsePermission(PermissionEnum.VIEW_ASSESSMENTS)
    clinicalSessionCancellationReasons(
        @Args('parentId', { type: () => Int, nullable: true }) parentId?: number,
        @Args('includeInactive', { type: () => Boolean, nullable: true }) includeInactive?: boolean,
    ): Promise<ClinicalSessionCancellationReason[]> {
        return this.reasonService.getReasons(parentId, includeInactive);
    }

    @Mutation(() => ClinicalSessionCancellationReason)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    createClinicalSessionCancellationReason(
        @Args('reason') input: CreateClinicalSessionCancellationReasonInput,
    ): Promise<ClinicalSessionCancellationReason> {
        return this.reasonService.createReason(input);
    }

    @Mutation(() => ClinicalSessionCancellationReason)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    updateClinicalSessionCancellationReason(
        @Args('reason') input: UpdateClinicalSessionCancellationReasonInput,
    ): Promise<ClinicalSessionCancellationReason> {
        return this.reasonService.updateReason(input);
    }

    @Mutation(() => ClinicalSessionCancellationReason)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    deactivateClinicalSessionCancellationReason(
        @Args('id', { type: () => Int }) id: number,
    ): Promise<ClinicalSessionCancellationReason> {
        return this.reasonService.deactivateReason(id);
    }
}
