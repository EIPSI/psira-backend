import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import { UseOrPermissions } from 'src/modules/permission/decorators/permission.decorator';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { PermissionGuard } from 'src/modules/permission/guards/permission.guard';
import {
    CreateCaseEventReasonInput,
    UpdateCaseEventReasonInput,
} from '../dtos/case-event-reason.input';
import {
    CreateCaseEventReasonTreeInput,
    UpdateCaseEventReasonTreeInput,
} from '../dtos/case-event-reason-tree.input';
import { CaseEventReasonContext } from '../enums/case-event-reason-context.enum';
import { CaseEventReason } from '../models/case-event-reason.model';
import { CaseEventReasonTree } from '../models/case-event-reason-tree.model';
import { CaseEventReasonService } from '../services/case-event-reason.service';

@Resolver(() => CaseEventReason)
@UseGuards(GqlAuthGuard, PermissionGuard)
export class CaseEventReasonResolver {
    constructor(private readonly reasonService: CaseEventReasonService) {}

    @Query(() => [CaseEventReasonTree])
    @UseOrPermissions([
        PermissionEnum.VIEW_SETTINGS,
        PermissionEnum.VIEW_ASSESSMENTS,
        PermissionEnum.VIEW_EVALUATION_AUTOMATIONS,
        PermissionEnum.MANAGE_EVALUATION_AUTOMATIONS,
        PermissionEnum.VIEW_ALL_EVALUATION_AUTOMATIONS,
        PermissionEnum.MANAGE_ALL_EVALUATION_AUTOMATIONS,
    ])
    caseEventReasonTrees(
        @Args('includeInactive', { type: () => Boolean, nullable: true }) includeInactive?: boolean,
    ): Promise<CaseEventReasonTree[]> {
        return this.reasonService.getTrees(includeInactive);
    }

    @Query(() => [CaseEventReason])
    @UseOrPermissions([
        PermissionEnum.VIEW_SETTINGS,
        PermissionEnum.VIEW_ASSESSMENTS,
        PermissionEnum.VIEW_EVALUATION_AUTOMATIONS,
        PermissionEnum.MANAGE_EVALUATION_AUTOMATIONS,
        PermissionEnum.VIEW_ALL_EVALUATION_AUTOMATIONS,
        PermissionEnum.MANAGE_ALL_EVALUATION_AUTOMATIONS,
    ])
    caseEventReasons(
        @Args('context', { type: () => CaseEventReasonContext }) context: CaseEventReasonContext,
        @Args('parentId', { type: () => Int, nullable: true }) parentId?: number | null,
        @Args('departmentId', { type: () => Int, nullable: true }) departmentId?: number | null,
        @Args('includeInactive', { type: () => Boolean, nullable: true }) includeInactive?: boolean,
        @Args('exactDepartment', { type: () => Boolean, nullable: true }) exactDepartment?: boolean,
    ): Promise<CaseEventReason[]> {
        return this.reasonService.getReasons(context, parentId, departmentId, includeInactive, exactDepartment);
    }

    @Mutation(() => CaseEventReason)
    @UseOrPermissions([PermissionEnum.MANAGE_SETTINGS, PermissionEnum.MANAGE_ASSESSMENTS])
    createCaseEventReason(
        @Args('reason') input: CreateCaseEventReasonInput,
    ): Promise<CaseEventReason> {
        return this.reasonService.createReason(input);
    }

    @Mutation(() => CaseEventReason)
    @UseOrPermissions([PermissionEnum.MANAGE_SETTINGS, PermissionEnum.MANAGE_ASSESSMENTS])
    updateCaseEventReason(
        @Args('reason') input: UpdateCaseEventReasonInput,
    ): Promise<CaseEventReason> {
        return this.reasonService.updateReason(input);
    }

    @Mutation(() => CaseEventReason)
    @UseOrPermissions([PermissionEnum.MANAGE_SETTINGS, PermissionEnum.MANAGE_ASSESSMENTS])
    deactivateCaseEventReason(
        @Args('id', { type: () => Int }) id: number,
    ): Promise<CaseEventReason> {
        return this.reasonService.deactivateReason(id);
    }

    @Mutation(() => Boolean)
    @UseOrPermissions([PermissionEnum.MANAGE_SETTINGS, PermissionEnum.MANAGE_ASSESSMENTS])
    deleteCaseEventReason(
        @Args('id', { type: () => Int }) id: number,
    ): Promise<boolean> {
        return this.reasonService.deleteReason(id);
    }

    @Mutation(() => CaseEventReasonTree)
    @UseOrPermissions([PermissionEnum.MANAGE_SETTINGS, PermissionEnum.MANAGE_ASSESSMENTS])
    createCaseEventReasonTree(
        @Args('tree') input: CreateCaseEventReasonTreeInput,
    ): Promise<CaseEventReasonTree> {
        return this.reasonService.createTree(input);
    }

    @Mutation(() => CaseEventReasonTree)
    @UseOrPermissions([PermissionEnum.MANAGE_SETTINGS, PermissionEnum.MANAGE_ASSESSMENTS])
    updateCaseEventReasonTree(
        @Args('tree') input: UpdateCaseEventReasonTreeInput,
    ): Promise<CaseEventReasonTree> {
        return this.reasonService.updateTree(input);
    }

    @Mutation(() => CaseEventReasonTree)
    @UseOrPermissions([PermissionEnum.MANAGE_SETTINGS, PermissionEnum.MANAGE_ASSESSMENTS])
    deactivateCaseEventReasonTree(
        @Args('id', { type: () => Int }) id: number,
    ): Promise<CaseEventReasonTree> {
        return this.reasonService.deactivateTree(id);
    }
}
