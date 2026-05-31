import { FilterableField, FilterableRelation } from '@nestjs-query/query-graphql';
import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import { AssessmentInformant } from 'src/modules/assessment/enums/assessment-informant.enum';
import { AssessmentType } from 'src/modules/assessment/models/assessment-type.model';
import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { EvaluationScheme } from './evaluation-scheme.model';

@ObjectType()
@FilterableRelation('scheme', () => EvaluationScheme)
@FilterableRelation('assessmentType', () => AssessmentType)
@Entity()
export class IndependentEvaluationTemplate extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => Int)
    @Column()
    schemeId: number;

    @FilterableField(() => Int)
    @Column()
    assessmentTypeId: number;

    @Field(() => [String], { nullable: true })
    @Column({ type: 'simple-json', nullable: true })
    questionnaireIds?: string[];

    @Field(() => [String], { nullable: true })
    @Column({ type: 'simple-json', nullable: true })
    questionnaireBundleIds?: string[];

    @Field(() => Int, { nullable: true })
    @Column({ nullable: true })
    relativeDay?: number;

    @Field(() => Int, { nullable: true })
    @Column({ nullable: true })
    relativeMinuteOfDay?: number;

    @Field(() => Int, { nullable: true })
    @Column({ nullable: true })
    startMinuteOfDay?: number;

    @Field(() => Int, { nullable: true })
    @Column({ nullable: true })
    durationMinutes?: number;

    @Field(() => Int, { nullable: true })
    @Column({ nullable: true })
    endMinuteOfDay?: number;

    @Field({ nullable: true })
    @Column({ nullable: true, default: 'BLOCK_START' })
    triggerMode?: string;

    @Field(() => Int, { nullable: true })
    @Column({ nullable: true })
    availabilityDurationMinutes?: number;

    @Field(() => [Int], { nullable: true })
    @Column({ type: 'simple-json', nullable: true })
    reminderMinutes?: number[];

    @Field({ nullable: true })
    @Column({ default: false })
    required?: boolean;

    @Field({ nullable: true })
    @Column({ default: true })
    singleResponse?: boolean;

    @Field(() => Int, { nullable: true })
    @Column({ nullable: true })
    seedOrder?: number;

    @Field({ nullable: true })
    @Column({ nullable: true, default: AssessmentInformant.PATIENT })
    informantType?: string;

    @Field({ nullable: true })
    @Column({ nullable: true })
    defaultResponderRole?: string;

    @FilterableField(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @FilterableField(() => GraphQLISODateTime)
    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => EvaluationScheme, scheme => scheme.independentEvaluationTemplates)
    scheme: EvaluationScheme;

    @ManyToOne(() => AssessmentType)
    assessmentType: AssessmentType;
}
