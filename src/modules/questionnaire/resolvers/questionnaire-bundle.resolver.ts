import { QueryArgsType } from '@nestjs-query/query-graphql';
import { Args, ArgsType, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Types } from 'mongoose';
import { QuestionnaireBundle } from '../models/questionnaire-bundle.schema';
import { QuestionnaireBundleService } from '../services/questionnaire-bundle.service';
import { SortDirection } from '@nestjs-query/core';
import { CreateQuestionnaireBundleInput, UpdateQuestionnaireBundleInput } from '../dtos/questionnaire-bundle.input';
import { UsePermission } from 'src/modules/permission/decorators/permission.decorator';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { CurrentUser } from 'src/modules/auth/auth-user.decorator';
import { User } from 'src/modules/user/models/user.model';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import { PermissionGuard } from 'src/modules/permission/guards/permission.guard';

@ArgsType()
export class QuestionniareBundleQuery extends QueryArgsType(
    QuestionnaireBundle,
) {}
const QuestionnaireBundleConnection = QuestionniareBundleQuery.ConnectionType;

@Resolver(() => QuestionnaireBundle)
@UseGuards(GqlAuthGuard, PermissionGuard)
export class QuestionnaireBundleResolver {
    constructor(
        private questionnaireBundleService: QuestionnaireBundleService,
    ) {}

    @Query(() => QuestionnaireBundle)
    @UsePermission(PermissionEnum.QUESTIONNAIRE_BUNDLES_VIEW_DEPARTMENT)
    getQuestionnaireBundle(
        @Args('_id', { type: () => String })
        questionnaireBundleId: Types.ObjectId,
    ): Promise<QuestionnaireBundle> {
        return this.questionnaireBundleService.getById(questionnaireBundleId);
    }

    @Query(() => QuestionnaireBundleConnection)
    @UsePermission(PermissionEnum.QUESTIONNAIRE_BUNDLES_VIEW_DEPARTMENT)
    async getQuestionnaireBundles(
        @Args() query: QuestionniareBundleQuery,
        @Args('departmentIds', { type: () => [Number], nullable: true })
        departmentIds: number[],
        @CurrentUser() currentUser: User,
    ) {
        query.sorting = query.sorting?.length
            ? query.sorting
            : [{ field: '_id', direction: SortDirection.DESC }];

        const result = await QuestionnaireBundleConnection.createFromPromise(
            q => this.questionnaireBundleService.list(q, departmentIds, currentUser),
            query,
        );
        return result;
    }

    @Mutation(() => QuestionnaireBundle)
    @UsePermission(PermissionEnum.QUESTIONNAIRE_BUNDLES_EDIT_DEPARTMENT)
    createQuestionnaireBundle(
        @Args('input') input: CreateQuestionnaireBundleInput,
        @CurrentUser() currentUser: User,
    ) {
        return this.questionnaireBundleService.createQuestionnaireBundle(
            input,
            currentUser,
        );
    }

    @Mutation(() => QuestionnaireBundle)
    @UsePermission(PermissionEnum.QUESTIONNAIRE_BUNDLES_DELETE_DEPARTMENT)
    deleteQuestionnaireBundle(@Args('_id', { type: () => String }) id: string) {
        return this.questionnaireBundleService.deleteQuestionnaireBundle(id);
    }

    @Mutation(() => QuestionnaireBundle)
    @UsePermission(PermissionEnum.QUESTIONNAIRES_EDIT_DEPARTMENT)
    updateQuestionnaireBundle(
        @Args('input') input: UpdateQuestionnaireBundleInput,
        @CurrentUser() currentUser: User,
    ) {
        return this.questionnaireBundleService.updateQuestionnaireBundle(input, currentUser)
    }
}
