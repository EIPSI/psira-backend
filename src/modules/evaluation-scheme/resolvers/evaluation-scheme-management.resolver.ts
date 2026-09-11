import { UseGuards } from '@nestjs/common';
import { Args, ArgsType, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { QueryArgsType } from '@nestjs-query/query-graphql';
import { SortDirection } from '@nestjs-query/core';
import { CurrentUser } from 'src/modules/auth/auth-user.decorator';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import { UsePermission } from 'src/modules/permission/decorators/permission.decorator';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { PermissionGuard } from 'src/modules/permission/guards/permission.guard';
import {
    AddSchemeResourceTemplateInput,
    CreateEvaluationSchemeInput,
    IndependentEvaluationTemplateInput,
    SchemeSessionTemplateInput,
    UpdateEvaluationSchemeInput,
    UpdateIndependentEvaluationTemplateInput,
    UpdateSchemeResourceTemplateInput,
} from '../dtos/evaluation-scheme-management.input';
import { IndependentEvaluationTemplate } from '../models/independent-evaluation-template.model';
import { EvaluationScheme } from '../models/evaluation-scheme.model';
import { SchemeResourceTemplate } from '../models/scheme-resource-template.model';
import { SchemeSessionTemplate } from '../models/scheme-session-template.model';
import { EvaluationSchemeManagementService } from '../services/evaluation-scheme-management.service';
import { User } from 'src/modules/user/models/user.model';

@ArgsType()
export class EvaluationSchemeQuery extends QueryArgsType(EvaluationScheme) {}
const EvaluationSchemeConnection = EvaluationSchemeQuery.ConnectionType;

@Resolver(() => EvaluationScheme)
@UseGuards(GqlAuthGuard, PermissionGuard)
export class EvaluationSchemeManagementResolver {
    constructor(
        private readonly managementService: EvaluationSchemeManagementService,
    ) {}

    @Query(() => EvaluationSchemeConnection)
    @UsePermission(PermissionEnum.EVALUATION_SCHEMES_VIEW_DEPARTMENT)
    async evaluationSchemes(
        @Args() query: EvaluationSchemeQuery,
        @Args('departmentIds', { type: () => [Int], nullable: true })
        departmentIds: number[],
        @CurrentUser() currentUser: User,
    ) {
        query.sorting = query.sorting?.length
            ? query.sorting
            : [{ field: 'id', direction: SortDirection.DESC }];

        return EvaluationSchemeConnection.createFromPromise(
            q => this.managementService.listSchemes(q, departmentIds, currentUser),
            query,
        );
    }

    @Mutation(() => EvaluationScheme)
    @UsePermission(PermissionEnum.EVALUATION_SCHEMES_EDIT_DEPARTMENT)
    createEvaluationScheme(
        @Args('scheme') input: CreateEvaluationSchemeInput,
    ): Promise<EvaluationScheme> {
        return this.managementService.createScheme(input);
    }

    @Mutation(() => EvaluationScheme)
    @UsePermission(PermissionEnum.EVALUATION_SCHEMES_EDIT_DEPARTMENT)
    updateEvaluationScheme(
        @Args('scheme') input: UpdateEvaluationSchemeInput,
    ): Promise<EvaluationScheme> {
        return this.managementService.updateScheme(input);
    }

    @Mutation(() => Boolean)
    @UsePermission(PermissionEnum.EVALUATION_SCHEMES_EDIT_DEPARTMENT)
    deleteEvaluationScheme(
        @Args('id', { type: () => Int }) id: number,
    ): Promise<boolean> {
        return this.managementService.deleteScheme(id);
    }

    @Mutation(() => SchemeSessionTemplate)
    @UsePermission(PermissionEnum.EVALUATION_SCHEMES_EDIT_DEPARTMENT)
    addSchemeSessionTemplate(
        @Args('sessionTemplate') input: SchemeSessionTemplateInput,
    ): Promise<SchemeSessionTemplate> {
        return this.managementService.addSessionTemplate(input);
    }

    @Mutation(() => SchemeResourceTemplate)
    @UsePermission(PermissionEnum.EVALUATION_SCHEMES_EDIT_DEPARTMENT)
    addSchemeResourceTemplate(
        @Args('resourceTemplate') input: AddSchemeResourceTemplateInput,
    ): Promise<SchemeResourceTemplate> {
        return this.managementService.addResourceTemplate(input);
    }

    @Mutation(() => SchemeResourceTemplate)
    @UsePermission(PermissionEnum.EVALUATION_SCHEMES_EDIT_DEPARTMENT)
    updateSchemeResourceTemplate(
        @Args('resourceTemplate') input: UpdateSchemeResourceTemplateInput,
    ): Promise<SchemeResourceTemplate> {
        return this.managementService.updateResourceTemplate(input);
    }

    @Mutation(() => Boolean)
    @UsePermission(PermissionEnum.EVALUATION_SCHEMES_EDIT_DEPARTMENT)
    deleteSchemeResourceTemplate(
        @Args('id', { type: () => Int }) id: number,
    ): Promise<boolean> {
        return this.managementService.deleteResourceTemplate(id);
    }

    @Mutation(() => IndependentEvaluationTemplate)
    @UsePermission(PermissionEnum.EVALUATION_SCHEMES_EDIT_DEPARTMENT)
    addIndependentEvaluationTemplate(
        @Args('evaluationTemplate') input: IndependentEvaluationTemplateInput,
    ): Promise<IndependentEvaluationTemplate> {
        return this.managementService.addIndependentEvaluationTemplate(input);
    }

    @Mutation(() => IndependentEvaluationTemplate)
    @UsePermission(PermissionEnum.EVALUATION_SCHEMES_EDIT_DEPARTMENT)
    updateIndependentEvaluationTemplate(
        @Args('evaluationTemplate') input: UpdateIndependentEvaluationTemplateInput,
    ): Promise<IndependentEvaluationTemplate> {
        return this.managementService.updateIndependentEvaluationTemplate(input);
    }

    @Mutation(() => Boolean)
    @UsePermission(PermissionEnum.EVALUATION_SCHEMES_EDIT_DEPARTMENT)
    deleteIndependentEvaluationTemplate(
        @Args('id', { type: () => Int }) id: number,
    ): Promise<boolean> {
        return this.managementService.deleteIndependentEvaluationTemplate(id);
    }

    @Mutation(() => Boolean)
    @UsePermission(PermissionEnum.EVALUATION_SCHEMES_EDIT_DEPARTMENT)
    clearIndependentEvaluationTemplates(
        @Args('schemeId', { type: () => Int }) schemeId: number,
    ): Promise<boolean> {
        return this.managementService.clearIndependentEvaluationTemplates(
            schemeId,
        );
    }
}
