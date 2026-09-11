import { FilterableField, FilterableRelation } from '@nestjs-query/query-graphql';
import { Field, Float, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import {
    BaseEntity,
    Check,
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { RandomizationRuleItemType } from '../enums/randomization-rule-item-type.enum';
import { RandomizationRule } from './randomization-rule.model';

@ObjectType()
@FilterableRelation('randomizationRule', () => RandomizationRule)
@Check(`"weight" > 0`)
@Check(`(
    ("itemType" = 'QUESTIONNAIRE' AND "questionnaireId" IS NOT NULL AND "questionnaireBundleId" IS NULL AND "evaluationSchemeId" IS NULL)
    OR ("itemType" = 'QUESTIONNAIRE_BUNDLE' AND "questionnaireId" IS NULL AND "questionnaireBundleId" IS NOT NULL AND "evaluationSchemeId" IS NULL)
    OR ("itemType" = 'EVALUATION_SCHEME' AND "questionnaireId" IS NULL AND "questionnaireBundleId" IS NULL AND "evaluationSchemeId" IS NOT NULL)
)`)
@Entity()
export class RandomizationRuleItem extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => Int)
    @Column()
    randomizationRuleId: number;

    @FilterableField(() => RandomizationRuleItemType)
    @Column({ type: 'enum', enum: RandomizationRuleItemType })
    itemType: RandomizationRuleItemType;

    @Field(() => String, { nullable: true })
    @Column({ nullable: true })
    questionnaireId?: string;

    @Field(() => String, { nullable: true })
    @Column({ nullable: true })
    questionnaireBundleId?: string;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    evaluationSchemeId?: number;

    @FilterableField(() => Float)
    @Column({ type: 'double precision' })
    weight: number;

    @FilterableField(() => Int)
    @Column()
    position: number;

    @FilterableField(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @FilterableField(() => GraphQLISODateTime)
    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(
        () => RandomizationRule,
        randomizationRule => randomizationRule.items,
        { onDelete: 'CASCADE' },
    )
    randomizationRule: RandomizationRule;
}
