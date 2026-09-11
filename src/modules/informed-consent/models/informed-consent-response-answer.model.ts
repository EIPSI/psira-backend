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
import { InformedConsentAnswerOption } from './informed-consent-answer-option.model';
import { InformedConsentQuestion } from './informed-consent-question.model';
import { InformedConsentResponse } from './informed-consent-response.model';

@ObjectType()
@FilterableRelation('response', () => InformedConsentResponse)
@FilterableRelation('question', () => InformedConsentQuestion)
@FilterableRelation('answerOption', () => InformedConsentAnswerOption, { nullable: true })
@Entity()
export class InformedConsentResponseAnswer extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => Int)
    @Column()
    responseId: number;

    @FilterableField(() => Int)
    @Column()
    questionId: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    answerOptionId?: number;

    @Field({ nullable: true })
    @Column({ type: 'text', nullable: true })
    valueText?: string;

    @Column({ type: 'jsonb', nullable: true })
    valueJson?: any;

    @FilterableField(() => InformedConsentAnswerResolution, { nullable: true })
    @Column({ type: 'varchar', nullable: true })
    resolution?: InformedConsentAnswerResolution;

    @Field(() => InformedConsentResponse)
    @ManyToOne(() => InformedConsentResponse, response => response.answers, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'responseId' })
    response: InformedConsentResponse;

    @Field(() => InformedConsentQuestion)
    @ManyToOne(() => InformedConsentQuestion)
    @JoinColumn({ name: 'questionId' })
    question: InformedConsentQuestion;

    @Field(() => InformedConsentAnswerOption, { nullable: true })
    @ManyToOne(() => InformedConsentAnswerOption, { nullable: true })
    @JoinColumn({ name: 'answerOptionId' })
    answerOption?: InformedConsentAnswerOption;
}
