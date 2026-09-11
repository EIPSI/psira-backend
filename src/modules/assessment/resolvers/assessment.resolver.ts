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
import { Assessment, FullAssessment } from '../models/assessment.model';
import { AssessmentService } from '../services/assessment.service';
import {
    UseOrPermissions,
    UsePermission,
} from '../../permission/decorators/permission.decorator';
import { PermissionEnum } from '../../permission/enums/permission.enum';
import {
    CreateFullAssessmentInput,
    UpdateFullAssessmentInput,
} from '../dtos/create-assessment.input';
import { QuestionnaireAssessment } from '../../questionnaire/models/questionnaire-assessment.schema';
import { ConnectionType } from '@nestjs-query/query-graphql';
import { CurrentUser } from 'src/modules/auth/auth-user.decorator';
import { User } from 'src/modules/user/models/user.model';
import {
    AssessmentQuery,
    AssessmentConnection,
} from '../dtos/assessment.query';

@Resolver(() => Assessment)
@UseGuards(GqlAuthGuard, PermissionGuard)
export class AssessmentResolver {
    constructor(private readonly assessmentService: AssessmentService) {}

    @Query(() => AssessmentConnection)
    @UseOrPermissions([
        PermissionEnum.ASSESSMENTS_VIEW_ALL,
        PermissionEnum.ASSESSMENTS_VIEW_DEPARTMENT,
        PermissionEnum.ASSESSMENTS_VIEW_ASSIGNED,
    ])
    async assessments(
        @Args({ type: () => AssessmentQuery }) query: AssessmentQuery,
        @CurrentUser() currentUser: User,
    ): Promise<ConnectionType<Assessment>> {
        return this.assessmentService.getAssessments(query, currentUser);
    }

    @Query(() => [Assessment])
    @UseOrPermissions([
        PermissionEnum.ASSESSMENTS_VIEW_ALL,
        PermissionEnum.ASSESSMENTS_VIEW_DEPARTMENT,
        PermissionEnum.ASSESSMENTS_VIEW_ASSIGNED,
    ])
    async patientAssessments(
        @Args('patientId', { type: () => Int }) patientId: number,
        @CurrentUser() currentUser: User,
        @Args('includeArchived', { nullable: true, defaultValue: false })
        includeArchived: boolean,
    ): Promise<Assessment[]> {
        return this.assessmentService.getPatientAssessments(
            patientId,
            currentUser,
            includeArchived,
        );
    }

    @Query(() => Assessment)
    @UseOrPermissions([
        PermissionEnum.ASSESSMENTS_VIEW_ALL,
        PermissionEnum.ASSESSMENTS_VIEW_DEPARTMENT,
        PermissionEnum.ASSESSMENTS_VIEW_ASSIGNED,
    ])
    async assessment(
        @Args('id', { type: () => ID }) patientId: number,
        @CurrentUser() currentUser: User,
    ): Promise<Assessment> {
        return this.assessmentService.getAssessment(patientId, currentUser);
    }

    @ResolveField('questionnaireAssessment', () => QuestionnaireAssessment)
    getQuestionnaireAssessment(@Parent() assessment: Assessment) {
        return this.assessmentService.getQuestionnaireAssessment(
            assessment.questionnaireAssessmentId,
        );
    }

    @Query(() => FullAssessment)
    @UseOrPermissions([
        PermissionEnum.ASSESSMENTS_VIEW_ALL,
        PermissionEnum.ASSESSMENTS_VIEW_DEPARTMENT,
        PermissionEnum.ASSESSMENTS_VIEW_ASSIGNED,
    ])
    getFullAssessment(
        @Args('id', { type: () => Int }) assessmentId: number,
        @CurrentUser() currentUser: User,
    ): Promise<FullAssessment> {
        return this.assessmentService.getFullAssessment(assessmentId, currentUser);
    }

    @Mutation(() => Assessment)
    @UseOrPermissions([
        PermissionEnum.ASSESSMENTS_CREATE_ALL,
        PermissionEnum.ASSESSMENTS_CREATE_DEPARTMENT,
        PermissionEnum.ASSESSMENTS_CREATE_ASSIGNED,
    ])
    createNewAssessment(
        @Args('assessment') assessmentInput: CreateFullAssessmentInput,
        @CurrentUser() currentUser: User,
    ) {
        return this.assessmentService.createNewAssessment(assessmentInput, currentUser);
    }

    @Mutation(() => Assessment)
    @UseOrPermissions([
        PermissionEnum.ASSESSMENTS_EDIT_ALL,
        PermissionEnum.ASSESSMENTS_EDIT_DEPARTMENT,
        PermissionEnum.ASSESSMENTS_EDIT_ASSIGNED,
    ])
    updateAssessment(
        @Args('assessment') assessmentInput: UpdateFullAssessmentInput,
        @CurrentUser() currentUser: User,
    ) {
        return this.assessmentService.updateAssessment(assessmentInput, currentUser);
    }

    @Mutation(() => Boolean)
    @UseOrPermissions([
        PermissionEnum.ASSESSMENTS_DELETE_ALL,
        PermissionEnum.ASSESSMENTS_DELETE_DEPARTMENT,
        PermissionEnum.ASSESSMENTS_DELETE_ASSIGNED,
    ])
    async deleteAssessment(
        @Args('id', { type: () => Int }) id: number,
        @Args('statusCancel', { nullable: true, defaultValue: true })
        statusCancel: boolean,
        @CurrentUser() currentUser: User,
    ) {
        await this.assessmentService.deleteAssessment(id, statusCancel, currentUser);
        return statusCancel;
    }

    @Mutation(() => Assessment)
    @UseOrPermissions([
        PermissionEnum.ASSESSMENTS_ARCHIVE_ALL,
        PermissionEnum.ASSESSMENTS_ARCHIVE_DEPARTMENT,
        PermissionEnum.ASSESSMENTS_ARCHIVE_ASSIGNED,
    ])
    async archiveOneAssessment(
        @Args('id', { type: () => Int }) id: number,
        @CurrentUser() currentUser: User,
    ): Promise<Assessment> {
        return await this.assessmentService.archiveOneAssessment(id, currentUser);
    }

    @Mutation(() => Assessment)
    @UseOrPermissions([
        PermissionEnum.ASSESSMENTS_RESTORE_ALL,
        PermissionEnum.ASSESSMENTS_RESTORE_DEPARTMENT,
        PermissionEnum.ASSESSMENTS_RESTORE_ASSIGNED,
    ])
    async restoreOneAssessment(
        @Args('id', { type: () => Int }) id: number,
        @CurrentUser() currentUser: User,
    ): Promise<Assessment> {
        return await this.assessmentService.restoreOneAssessment(id, currentUser);
    }

}
