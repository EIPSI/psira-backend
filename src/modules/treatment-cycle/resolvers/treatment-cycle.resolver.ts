import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from 'src/modules/auth/auth-user.decorator';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import { UsePermission } from 'src/modules/permission/decorators/permission.decorator';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { PermissionGuard } from 'src/modules/permission/guards/permission.guard';
import { User } from 'src/modules/user/models/user.model';
import {
    CancelTreatmentCycleFinalizationInput,
    CaseHistoryFilterInput,
    CreateCaseHistoryNoteInput,
    FinalizeTreatmentCycleInput,
    StartNewTreatmentCycleInput,
    TreatmentCycleListFilterInput,
} from '../dtos/treatment-cycle.input';
import { CaseHistoryEntry } from '../models/case-history-entry.model';
import { TreatmentCycle } from '../models/treatment-cycle.model';
import { TreatmentCycleService } from '../services/treatment-cycle.service';

@Resolver(() => TreatmentCycle)
@UseGuards(GqlAuthGuard, PermissionGuard)
export class TreatmentCycleResolver {
    constructor(private readonly treatmentCycleService: TreatmentCycleService) {}

    @Query(() => TreatmentCycle)
    @UsePermission(PermissionEnum.VIEW_ASSESSMENTS)
    treatmentCycle(
        @Args('id', { type: () => Int }) id: number,
    ): Promise<TreatmentCycle> {
        return this.treatmentCycleService.getCycle(id);
    }

    @Query(() => [TreatmentCycle])
    @UsePermission(PermissionEnum.VIEW_ASSESSMENTS)
    treatmentCycles(
        @Args('filter', { type: () => TreatmentCycleListFilterInput, nullable: true })
        filter?: TreatmentCycleListFilterInput,
    ): Promise<TreatmentCycle[]> {
        return this.treatmentCycleService.listCycles(filter);
    }

    @Query(() => TreatmentCycle, { nullable: true })
    @UsePermission(PermissionEnum.VIEW_ASSESSMENTS)
    activeTreatmentCycle(
        @Args('filter', { type: () => TreatmentCycleListFilterInput })
        filter: TreatmentCycleListFilterInput,
    ): Promise<TreatmentCycle | undefined> {
        return this.treatmentCycleService.getActiveCycle(filter);
    }

    @Mutation(() => TreatmentCycle)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    finalizeTreatmentCycle(
        @Args('input') input: FinalizeTreatmentCycleInput,
        @CurrentUser() currentUser: User,
    ): Promise<TreatmentCycle> {
        return this.treatmentCycleService.finalizeCycle(input, currentUser);
    }

    @Mutation(() => TreatmentCycle)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    cancelTreatmentCycleFinalization(
        @Args('input') input: CancelTreatmentCycleFinalizationInput,
        @CurrentUser() currentUser: User,
    ): Promise<TreatmentCycle> {
        return this.treatmentCycleService.cancelFinalization(input, currentUser);
    }

    @Mutation(() => TreatmentCycle)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    startNewTreatmentCycle(
        @Args('input') input: StartNewTreatmentCycleInput,
        @CurrentUser() currentUser: User,
    ): Promise<TreatmentCycle> {
        return this.treatmentCycleService.startNewTreatmentCycle(input, currentUser);
    }

    @Mutation(() => CaseHistoryEntry)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    createCaseHistoryNote(
        @Args('input') input: CreateCaseHistoryNoteInput,
        @CurrentUser() currentUser: User,
    ): Promise<CaseHistoryEntry> {
        return this.treatmentCycleService.createCaseHistoryNote(input, currentUser);
    }

    @Query(() => [CaseHistoryEntry])
    @UsePermission(PermissionEnum.VIEW_ASSESSMENTS)
    caseHistoryEntries(
        @Args('filter', { type: () => CaseHistoryFilterInput })
        filter: CaseHistoryFilterInput,
    ): Promise<CaseHistoryEntry[]> {
        return this.treatmentCycleService.caseHistoryEntries(filter);
    }
}
