import { SortDirection } from '@nestjs-query/core';
import { QueryArgsType } from '@nestjs-query/query-graphql';
import { UseGuards } from '@nestjs/common';
import { Args, ArgsType, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from 'src/modules/auth/auth-user.decorator';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import { UseOrPermissions } from 'src/modules/permission/decorators/permission.decorator';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { PermissionGuard } from 'src/modules/permission/guards/permission.guard';
import { User } from 'src/modules/user/models/user.model';
import {
    CreateEvaluationAutomationInput,
    UpdateEvaluationAutomationInput,
} from '../dtos/evaluation-automation.input';
import { EvaluationAutomationPreviewInput } from '../dtos/evaluation-automation-preview.input';
import { EvaluationAutomationPreviewResultDto } from '../dtos/evaluation-automation-preview-result.dto';
import { EvaluationAutomationTestResultDto } from '../dtos/evaluation-automation-test-result.dto';
import { TestEvaluationAutomationInput } from '../dtos/evaluation-automation-test.input';
import { EvaluationAutomationRun } from '../models/evaluation-automation-run.model';
import { EvaluationAutomation } from '../models/evaluation-automation.model';
import { EvaluationAutomationManagementService } from '../services/evaluation-automation-management.service';

@ArgsType()
export class EvaluationAutomationQuery extends QueryArgsType(EvaluationAutomation) {}
const EvaluationAutomationConnection = EvaluationAutomationQuery.ConnectionType;

@ArgsType()
export class EvaluationAutomationRunQuery extends QueryArgsType(EvaluationAutomationRun) {}
const EvaluationAutomationRunConnection = EvaluationAutomationRunQuery.ConnectionType;

@Resolver(() => EvaluationAutomation)
@UseGuards(GqlAuthGuard, PermissionGuard)
export class EvaluationAutomationResolver {
    constructor(
        private readonly managementService: EvaluationAutomationManagementService,
    ) {}

    @Query(() => EvaluationAutomation)
    @UseOrPermissions([
        PermissionEnum.AUTOMATIONS_VIEW_DEPARTMENT,
        PermissionEnum.AUTOMATIONS_VIEW_ALL,
    ])
    evaluationAutomation(
        @Args('id', { type: () => Int }) id: number,
        @CurrentUser() currentUser: User,
    ): Promise<EvaluationAutomation> {
        return this.managementService.getAutomationOrFail(id, currentUser);
    }

    @Query(() => EvaluationAutomationConnection)
    @UseOrPermissions([
        PermissionEnum.AUTOMATIONS_VIEW_DEPARTMENT,
        PermissionEnum.AUTOMATIONS_VIEW_ALL,
    ])
    async evaluationAutomations(
        @Args() query: EvaluationAutomationQuery,
        @CurrentUser() currentUser: User,
    ) {
        query.sorting = query.sorting?.length
            ? query.sorting
            : [{ field: 'id', direction: SortDirection.DESC }];

        return EvaluationAutomationConnection.createFromPromise(
            q => this.managementService.listAutomations(q, currentUser),
            query,
        );
    }

    @Query(() => EvaluationAutomationRunConnection)
    @UseOrPermissions([
        PermissionEnum.AUTOMATIONS_VIEW_DEPARTMENT,
        PermissionEnum.AUTOMATIONS_VIEW_ALL,
    ])
    async evaluationAutomationRuns(
        @Args() query: EvaluationAutomationRunQuery,
        @Args('automationId', { type: () => Int, nullable: true })
        automationId?: number,
        @CurrentUser() currentUser?: User,
    ) {
        query.sorting = query.sorting?.length
            ? query.sorting
            : [{ field: 'createdAt', direction: SortDirection.DESC }];

        return EvaluationAutomationRunConnection.createFromPromise(
            q => this.managementService.listRuns(q, automationId, currentUser),
            query,
        );
    }

    @Query(() => [EvaluationAutomationPreviewResultDto])
    @UseOrPermissions([
        PermissionEnum.AUTOMATIONS_VIEW_DEPARTMENT,
        PermissionEnum.AUTOMATIONS_VIEW_ALL,
    ])
    evaluationAutomationPreview(
        @Args('input') input: EvaluationAutomationPreviewInput,
        @CurrentUser() currentUser: User,
    ): Promise<EvaluationAutomationPreviewResultDto[]> {
        return this.managementService.previewAutomations(input, currentUser);
    }

    @Mutation(() => EvaluationAutomation)
    @UseOrPermissions([
        PermissionEnum.AUTOMATIONS_EDIT_DEPARTMENT,
        PermissionEnum.AUTOMATIONS_EDIT_ALL,
    ])
    createEvaluationAutomation(
        @Args('automation') input: CreateEvaluationAutomationInput,
        @CurrentUser() currentUser: User,
    ): Promise<EvaluationAutomation> {
        return this.managementService.createAutomation(input, currentUser);
    }

    @Mutation(() => EvaluationAutomation)
    @UseOrPermissions([
        PermissionEnum.AUTOMATIONS_EDIT_DEPARTMENT,
        PermissionEnum.AUTOMATIONS_EDIT_ALL,
    ])
    updateEvaluationAutomation(
        @Args('automation') input: UpdateEvaluationAutomationInput,
        @CurrentUser() currentUser: User,
    ): Promise<EvaluationAutomation> {
        return this.managementService.updateAutomation(input, currentUser);
    }

    @Mutation(() => EvaluationAutomation)
    @UseOrPermissions([
        PermissionEnum.AUTOMATIONS_EDIT_DEPARTMENT,
        PermissionEnum.AUTOMATIONS_EDIT_ALL,
    ])
    duplicateEvaluationAutomation(
        @Args('id', { type: () => Int }) id: number,
        @CurrentUser() currentUser: User,
    ): Promise<EvaluationAutomation> {
        return this.managementService.duplicateAutomation(id, currentUser);
    }

    @Mutation(() => EvaluationAutomation)
    @UseOrPermissions([
        PermissionEnum.AUTOMATIONS_EDIT_DEPARTMENT,
        PermissionEnum.AUTOMATIONS_EDIT_ALL,
    ])
    setEvaluationAutomationActive(
        @Args('id', { type: () => Int }) id: number,
        @Args('active', { type: () => Boolean }) active: boolean,
        @CurrentUser() currentUser: User,
    ): Promise<EvaluationAutomation> {
        return this.managementService.setActive(id, active, currentUser);
    }

    @Mutation(() => Boolean)
    @UseOrPermissions([
        PermissionEnum.AUTOMATIONS_EDIT_DEPARTMENT,
        PermissionEnum.AUTOMATIONS_EDIT_ALL,
    ])
    deleteEvaluationAutomation(
        @Args('id', { type: () => Int }) id: number,
        @CurrentUser() currentUser: User,
    ): Promise<boolean> {
        return this.managementService.deleteAutomation(id, currentUser);
    }

    @Mutation(() => EvaluationAutomationTestResultDto)
    @UseOrPermissions([
        PermissionEnum.AUTOMATIONS_EDIT_DEPARTMENT,
        PermissionEnum.AUTOMATIONS_EDIT_ALL,
    ])
    testEvaluationAutomation(
        @Args('input') input: TestEvaluationAutomationInput,
        @CurrentUser() currentUser: User,
    ): Promise<EvaluationAutomationTestResultDto> {
        return this.managementService.testAutomation(input, currentUser);
    }
}
