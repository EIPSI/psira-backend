import { Field, Float, InputType, Int } from '@nestjs/graphql';
import { RandomizationRuleItemType } from '../enums/randomization-rule-item-type.enum';
import { RandomizationRuleType } from '../enums/randomization-rule-type.enum';

@InputType()
export class RandomizationRuleItemInput {
    @Field(() => RandomizationRuleItemType)
    itemType: RandomizationRuleItemType;

    @Field(() => String, { nullable: true })
    questionnaireId?: string;

    @Field(() => String, { nullable: true })
    questionnaireBundleId?: string;

    @Field(() => Int, { nullable: true })
    evaluationSchemeId?: number;

    @Field(() => Float)
    weight: number;

    @Field(() => Int, { nullable: true })
    position?: number;
}

@InputType()
export class CreateRandomizationRuleInput {
    @Field()
    name: string;

    @Field(() => RandomizationRuleType)
    type: RandomizationRuleType;

    @Field(() => Boolean, { nullable: true })
    active?: boolean;

    @Field(() => [Int], { nullable: true })
    departmentIds?: number[];

    @Field(() => [RandomizationRuleItemInput])
    items: RandomizationRuleItemInput[];
}

@InputType()
export class UpdateRandomizationRuleInput {
    @Field(() => Int)
    id: number;

    @Field(() => String, { nullable: true })
    name?: string;

    @Field(() => RandomizationRuleType, { nullable: true })
    type?: RandomizationRuleType;

    @Field(() => Boolean, { nullable: true })
    active?: boolean;

    @Field(() => [Int], { nullable: true })
    departmentIds?: number[];

    @Field(() => [RandomizationRuleItemInput], { nullable: true })
    items?: RandomizationRuleItemInput[];
}
