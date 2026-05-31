import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Resolver } from '@nestjs/graphql';
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

@Resolver(() => EvaluationScheme)
@UseGuards(GqlAuthGuard, PermissionGuard)
export class EvaluationSchemeManagementResolver {
    constructor(
        private readonly managementService: EvaluationSchemeManagementService,
    ) {}

    @Mutation(() => EvaluationScheme)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    createEvaluationScheme(
        @Args('scheme') input: CreateEvaluationSchemeInput,
    ): Promise<EvaluationScheme> {
        return this.managementService.createScheme(input);
    }

    @Mutation(() => EvaluationScheme)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    updateEvaluationScheme(
        @Args('scheme') input: UpdateEvaluationSchemeInput,
    ): Promise<EvaluationScheme> {
        return this.managementService.updateScheme(input);
    }

    @Mutation(() => Boolean)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    deleteEvaluationScheme(
        @Args('id', { type: () => Int }) id: number,
    ): Promise<boolean> {
        return this.managementService.deleteScheme(id);
    }

    @Mutation(() => SchemeSessionTemplate)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    addSchemeSessionTemplate(
        @Args('sessionTemplate') input: SchemeSessionTemplateInput,
    ): Promise<SchemeSessionTemplate> {
        return this.managementService.addSessionTemplate(input);
    }

    @Mutation(() => SchemeResourceTemplate)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    addSchemeResourceTemplate(
        @Args('resourceTemplate') input: AddSchemeResourceTemplateInput,
    ): Promise<SchemeResourceTemplate> {
        return this.managementService.addResourceTemplate(input);
    }

    @Mutation(() => SchemeResourceTemplate)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    updateSchemeResourceTemplate(
        @Args('resourceTemplate') input: UpdateSchemeResourceTemplateInput,
    ): Promise<SchemeResourceTemplate> {
        return this.managementService.updateResourceTemplate(input);
    }

    @Mutation(() => Boolean)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    deleteSchemeResourceTemplate(
        @Args('id', { type: () => Int }) id: number,
    ): Promise<boolean> {
        return this.managementService.deleteResourceTemplate(id);
    }

    @Mutation(() => IndependentEvaluationTemplate)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    addIndependentEvaluationTemplate(
        @Args('evaluationTemplate') input: IndependentEvaluationTemplateInput,
    ): Promise<IndependentEvaluationTemplate> {
        return this.managementService.addIndependentEvaluationTemplate(input);
    }

    @Mutation(() => IndependentEvaluationTemplate)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    updateIndependentEvaluationTemplate(
        @Args('evaluationTemplate') input: UpdateIndependentEvaluationTemplateInput,
    ): Promise<IndependentEvaluationTemplate> {
        return this.managementService.updateIndependentEvaluationTemplate(input);
    }

    @Mutation(() => Boolean)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    deleteIndependentEvaluationTemplate(
        @Args('id', { type: () => Int }) id: number,
    ): Promise<boolean> {
        return this.managementService.deleteIndependentEvaluationTemplate(id);
    }

    @Mutation(() => Boolean)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    clearIndependentEvaluationTemplates(
        @Args('schemeId', { type: () => Int }) schemeId: number,
    ): Promise<boolean> {
        return this.managementService.clearIndependentEvaluationTemplates(
            schemeId,
        );
    }
}
