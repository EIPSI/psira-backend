import { CurrentUser } from 'src/modules/auth/auth-user.decorator';
import { User } from 'src/modules/user/models/user.model';
import { departmentDefinitionFilter } from 'src/shared/department-definition-access';
import { mergeFilter } from '@nestjs-query/core';
import { filterProjectResources } from 'src/shared/project-resource-access';
import { UseGuards } from '@nestjs/common';
import {
    Resolver,
    Query,
    Int,
    Args,
    Mutation,
    ResolveField,
    Parent,
    ID,
} from '@nestjs/graphql';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import { PermissionGuard } from 'src/modules/permission/guards/permission.guard';
import {
    AssessmentTypeConnection,
    AssessmentTypeQuery,
} from '../dtos/assessment-type.query';
import { AssessmentType } from '../models/assessment-type.model';
import { Assessment, FullAssessment } from '../models/assessment.model';
import { AssessmentTypeService } from '../services/assessment-type.service';
import { AssessmentService } from '../services/assessment.service';
import { ConnectionType } from '@nestjs-query/query-graphql';
import {
    CreateAssessmentTypeInput,
    UpdateAssessmentTypeInput,
} from '../dtos/create-assessment-type.input';

@Resolver(() => AssessmentType)
@UseGuards(GqlAuthGuard, PermissionGuard)
export class AssessmentTypeResolver {
    constructor(
        private readonly assessmentTypeService: AssessmentTypeService,
    ) {}

    @Query(() => AssessmentTypeConnection)
    // @UsePermission(PermissionEnum.ASSESSMENTS_VIEW_DEPARTMENT)
    async assessmentTypes(
        @Args({ type: () => AssessmentTypeQuery }) query: AssessmentTypeQuery,
        @CurrentUser() user: User,
    ): Promise<ConnectionType<AssessmentType>> {
        query.filter = mergeFilter(query.filter, await departmentDefinitionFilter('AssessmentType', { req: { user } }));
        return this.assessmentTypeService.getAssessmentTypes(query);
    }

    @Query(() => [AssessmentType])
    // @UsePermission(PermissionEnum.ASSESSMENTS_VIEW_DEPARTMENT)
    async activeAssessmentTypes(@CurrentUser() user: User): Promise<AssessmentType[]> {
        return filterProjectResources(user.id, await this.assessmentTypeService.getActiveAssessmentTypes());
    }

    @Mutation(() => AssessmentType)
    // @UsePermission(PermissionEnum.ASSESSMENTS_EDIT_DEPARTMENT)
    createNewAssessmentType(
        @Args('assessmentType') assessmentTypeInput: CreateAssessmentTypeInput,
    ) {
        return this.assessmentTypeService.createAssessmentType(
            assessmentTypeInput,
        );
    }

    @Mutation(() => AssessmentType)
    // @UsePermission(PermissionEnum.ASSESSMENTS_EDIT_DEPARTMENT)
    updateAssessmentType(
        @Args('assessmentType') assessmentTypeInput: UpdateAssessmentTypeInput,
    ) {
        return this.assessmentTypeService.updateAssessmentType(
            assessmentTypeInput,
        );
    }

    @Mutation(() => Boolean)
    // @UsePermission(PermissionEnum.ASSESSMENTS_EDIT_DEPARTMENT)
    deleteAssessmentType(@Args('id') assessmentTypeId: number) {
        return this.assessmentTypeService.deleteAssessmentType(
            assessmentTypeId,
        );
    }
}
