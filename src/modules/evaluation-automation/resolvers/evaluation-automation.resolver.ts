import { SortDirection } from '@nestjs-query/core';
import { QueryArgsType } from '@nestjs-query/query-graphql';
import { UseGuards } from '@nestjs/common';
import { Args, ArgsType, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import { UsePermission } from 'src/modules/permission/decorators/permission.decorator';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { PermissionGuard } from 'src/modules/permission/guards/permission.guard';
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
    @UsePermission(PermissionEnum.VIEW_ASSESSMENTS)
    evaluationAutomation(
        @Args('id', { type: () => Int }) id: number,
    ): Promise<EvaluationAutomation> {
        return this.managementService.getAutomationOrFail(id);
    }

    @Query(() => EvaluationAutomationConnection)
    @UsePermission(PermissionEnum.VIEW_ASSESSMENTS)
    async evaluationAutomations(
        @Args() query: EvaluationAutomationQuery,
    ) {
        query.sorting = query.sorting?.length
            ? query.sorting
            : [{ field: 'id', direction: SortDirection.DESC }];

        return EvaluationAutomationConnection.createFromPromise(
            q => this.managementService.listAutomations(q),
            query,
        );
    }

    @Query(() => EvaluationAutomationRunConnection)
    @UsePermission(PermissionEnum.VIEW_ASSESSMENTS)
    async evaluationAutomationRuns(
        @Args() query: EvaluationAutomationRunQuery,
        @Args('automationId', { type: () => Int, nullable: true })
        automationId?: number,
    ) {
        query.sorting = query.sorting?.length
            ? query.sorting
            : [{ field: 'createdAt', direction: SortDirection.DESC }];

        return EvaluationAutomationRunConnection.createFromPromise(
            q => this.managementService.listRuns(q, automationId),
            query,
        );
    }

    @Query(() => [EvaluationAutomationPreviewResultDto])
    @UsePermission(PermissionEnum.VIEW_ASSESSMENTS)
    evaluationAutomationPreview(
        @Args('input') input: EvaluationAutomationPreviewInput,
    ): Promise<EvaluationAutomationPreviewResultDto[]> {
        return this.managementService.previewAutomations(input);
    }

    @Mutation(() => EvaluationAutomation)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    createEvaluationAutomation(
        @Args('automation') input: CreateEvaluationAutomationInput,
    ): Promise<EvaluationAutomation> {
        return this.managementService.createAutomation(input);
    }

    @Mutation(() => EvaluationAutomation)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    updateEvaluationAutomation(
        @Args('automation') input: UpdateEvaluationAutomationInput,
    ): Promise<EvaluationAutomation> {
        return this.managementService.updateAutomation(input);
    }

    @Mutation(() => EvaluationAutomation)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    duplicateEvaluationAutomation(
        @Args('id', { type: () => Int }) id: number,
    ): Promise<EvaluationAutomation> {
        return this.managementService.duplicateAutomation(id);
    }

    @Mutation(() => EvaluationAutomation)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    setEvaluationAutomationActive(
        @Args('id', { type: () => Int }) id: number,
        @Args('active', { type: () => Boolean }) active: boolean,
    ): Promise<EvaluationAutomation> {
        return this.managementService.setActive(id, active);
    }

    @Mutation(() => Boolean)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    deleteEvaluationAutomation(
        @Args('id', { type: () => Int }) id: number,
    ): Promise<boolean> {
        return this.managementService.deleteAutomation(id);
    }

    @Mutation(() => EvaluationAutomationTestResultDto)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    testEvaluationAutomation(
        @Args('input') input: TestEvaluationAutomationInput,
    ): Promise<EvaluationAutomationTestResultDto> {
        return this.managementService.testAutomation(input);
    }
}
