import { FilterableField, FilterableRelation } from '@nestjs-query/query-graphql';
import { Field, Int, ObjectType } from '@nestjs/graphql';
import {
    BaseEntity,
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { InformedConsentAnswerResolution } from '../enums/informed-consent-answer-resolution.enum';
import { InformedConsentQuestion } from './informed-consent-question.model';

@ObjectType()
@FilterableRelation('question', () => InformedConsentQuestion)
@Entity()
export class InformedConsentAnswerOption extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => Int)
    @Column()
    questionId: number;

    @FilterableField(() => Int)
    @Column()
    orderIndex: number;

    @Field()
    @Column()
    value: string;

    @Field()
    @Column({ type: 'text' })
    label: string;

    @FilterableField(() => InformedConsentAnswerResolution)
    @Column({ type: 'varchar' })
    resolution: InformedConsentAnswerResolution;

    @FilterableField()
    @Column({ default: false })
    blocksUsageOnSelection: boolean;

    @Field(() => InformedConsentQuestion)
    @ManyToOne(() => InformedConsentQuestion, question => question.answerOptions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'questionId' })
    question: InformedConsentQuestion;
}
