import { Args, Resolver, Query, Mutation, ArgsType } from '@nestjs/graphql';

import {
    CreateQuestionnaireInput,
    UpdateQuestionnaireInput,
} from '../dtos/questionnaire.input';
import { QuestionnaireService } from '../services/questionnaire.service';
import { Questionnaire } from '../models/questionnaire.schema';
import { Types } from 'mongoose';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import { PermissionGuard } from 'src/modules/permission/guards/permission.guard';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { UsePermission } from 'src/modules/permission/decorators/permission.decorator';
import { QueryArgsType } from '@nestjs-query/query-graphql';
import { SortDirection } from '@nestjs-query/core';
import { CurrentUser } from 'src/modules/auth/auth-user.decorator';
import { User } from 'src/modules/user/models/user.model';

@ArgsType()
export class QuestionniareQuery extends QueryArgsType(Questionnaire) {}
const QuestionnaireConnection = QuestionniareQuery.ConnectionType;

@Resolver(() => Questionnaire)
@UseGuards(GqlAuthGuard, PermissionGuard)
export class QuestionnaireResolver {
    constructor(private questionnaireService: QuestionnaireService) {}

    @Query(() => Questionnaire)
    getQuestionnaire(
        @Args('_id', { type: () => String }) questionnaireId: Types.ObjectId,
    ): Promise<Questionnaire> {
        return this.questionnaireService.getById(questionnaireId);
    }

    @Query(() => Questionnaire)
    @UsePermission(PermissionEnum.QUESTIONNAIRES_VIEW_DEPARTMENT)
    getQuestionnaireVersion(
        @Args('_id', { type: () => String }) questionnaireId: Types.ObjectId,
    ): Promise<Questionnaire> {
        return this.questionnaireService.getById(
            questionnaireId,
        );
    }

    @Query(() => QuestionnaireConnection)
    async questionnaires(
        @Args() query: QuestionniareQuery,
        @Args('departmentIds', { type: () => [Number], nullable: true })
        departmentIds: number[],
        @CurrentUser() currentUser: User,
    ) {
        query.sorting = query.sorting?.length
            ? query.sorting
            : [{ field: '_id', direction: SortDirection.DESC }];

        const result = await QuestionnaireConnection.createFromPromise(
            q => this.questionnaireService.list(q, currentUser, departmentIds),
            query,
        );
        return result;
    }

    @Mutation(() => Questionnaire)
    @UsePermission(PermissionEnum.QUESTIONNAIRES_EDIT_DEPARTMENT)
    async createQuestionnaire(
        @Args('xlsForm', { type: () => CreateQuestionnaireInput })
        xlsForm: CreateQuestionnaireInput,
        @CurrentUser() currentUser: User,
    ): Promise<Questionnaire> {
        return this.questionnaireService.create(xlsForm, currentUser);
    }

    @Mutation(() => Questionnaire)
    @UsePermission(PermissionEnum.QUESTIONNAIRES_EDIT_DEPARTMENT)
    async updateQuestionnaire(
        @Args('_id', { type: () => String })
        id: Types.ObjectId,

        @Args('xlsForm', { type: () => UpdateQuestionnaireInput })
        xlsForm: UpdateQuestionnaireInput,
        @CurrentUser() currentUser: User,
    ): Promise<Questionnaire> {
        return this.questionnaireService.updateOne(id, xlsForm, currentUser);
    }

    @Mutation(() => Questionnaire)
    @UsePermission(PermissionEnum.QUESTIONNAIRES_DELETE_DEPARTMENT)
    async deleteQuestionnaire(
        @Args('_id', { type: () => String }) questionnaireId: string,
    ) {
        const _id = Types.ObjectId(questionnaireId);
        return this.questionnaireService.deleteQuestionnaire(_id);
    }
}
