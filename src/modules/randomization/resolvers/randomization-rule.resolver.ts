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
    CreateRandomizationRuleInput,
    UpdateRandomizationRuleInput,
} from '../dtos/randomization-rule.input';
import { RandomizationRule } from '../models/randomization-rule.model';
import { RandomizationRuleService } from '../services/randomization-rule.service';
import { User } from 'src/modules/user/models/user.model';

@ArgsType()
export class RandomizationRuleQuery extends QueryArgsType(RandomizationRule) {}
const RandomizationRuleConnection = RandomizationRuleQuery.ConnectionType;

@Resolver(() => RandomizationRule)
@UseGuards(GqlAuthGuard, PermissionGuard)
export class RandomizationRuleResolver {
    constructor(
        private readonly randomizationRuleService: RandomizationRuleService,
    ) {}

    @Query(() => RandomizationRule)
    @UsePermission(PermissionEnum.VIEW_ASSESSMENTS)
    getRandomizationRule(
        @Args('id', { type: () => Int }) id: number,
    ): Promise<RandomizationRule> {
        return this.randomizationRuleService.getRuleOrFail(id);
    }

    @Query(() => RandomizationRuleConnection)
    @UsePermission(PermissionEnum.VIEW_ASSESSMENTS)
    async randomizationRules(
        @Args() query: RandomizationRuleQuery,
        @Args('departmentIds', { type: () => [Int], nullable: true })
        departmentIds: number[],
        @CurrentUser() currentUser: User,
    ) {
        query.sorting = query.sorting?.length
            ? query.sorting
            : [{ field: 'id', direction: SortDirection.DESC }];

        return RandomizationRuleConnection.createFromPromise(
            q => this.randomizationRuleService.list(q, departmentIds, currentUser),
            query,
        );
    }

    @Mutation(() => RandomizationRule)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    createRandomizationRule(
        @Args('rule') input: CreateRandomizationRuleInput,
        @CurrentUser() currentUser: User,
    ): Promise<RandomizationRule> {
        return this.randomizationRuleService.createRule(input, currentUser);
    }

    @Mutation(() => RandomizationRule)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    updateRandomizationRule(
        @Args('rule') input: UpdateRandomizationRuleInput,
        @CurrentUser() currentUser: User,
    ): Promise<RandomizationRule> {
        return this.randomizationRuleService.updateRule(input, currentUser);
    }

    @Mutation(() => RandomizationRule)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    duplicateRandomizationRule(
        @Args('id', { type: () => Int }) id: number,
        @CurrentUser() currentUser: User,
    ): Promise<RandomizationRule> {
        return this.randomizationRuleService.duplicateRule(id, currentUser);
    }

    @Mutation(() => RandomizationRule)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    setRandomizationRuleActive(
        @Args('id', { type: () => Int }) id: number,
        @Args('active', { type: () => Boolean }) active: boolean,
    ): Promise<RandomizationRule> {
        return this.randomizationRuleService.setActive(id, active);
    }

    @Mutation(() => Boolean)
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    deleteRandomizationRule(
        @Args('id', { type: () => Int }) id: number,
    ): Promise<boolean> {
        return this.randomizationRuleService.deleteRule(id);
    }
}
