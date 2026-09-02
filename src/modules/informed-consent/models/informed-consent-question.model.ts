import { FilterableField, FilterableRelation, FilterableUnPagedRelation } from '@nestjs-query/query-graphql';
import { Field, Int, ObjectType } from '@nestjs/graphql';
import {
    BaseEntity,
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { InformedConsentKind } from '../enums/informed-consent-kind.enum';
import { InformedConsentQuestionType } from '../enums/informed-consent-question-type.enum';
import { InformedConsentAnswerOption } from './informed-consent-answer-option.model';
import { InformedConsentVersion } from './informed-consent-version.model';

@ObjectType()
@FilterableRelation('version', () => InformedConsentVersion)
@FilterableUnPagedRelation('answerOptions', () => InformedConsentAnswerOption, { nullable: true })
@Entity()
export class InformedConsentQuestion extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => Int)
    @Column()
    versionId: number;

    @FilterableField(() => InformedConsentKind)
    @Column({ type: 'varchar' })
    kind: InformedConsentKind;

    @Field(() => [InformedConsentKind], { nullable: true })
    @Column({ type: 'simple-array', nullable: true })
    kinds?: InformedConsentKind[];

    @FilterableField(() => InformedConsentQuestionType)
    @Column({ type: 'varchar' })
    questionType: InformedConsentQuestionType;

    @FilterableField(() => Int)
    @Column()
    orderIndex: number;

    @Field()
    @Column({ type: 'text' })
    label: string;

    @Field({ nullable: true })
    @Column({ type: 'text', nullable: true })
    helpText?: string;

    @FilterableField()
    @Column({ default: true })
    required: boolean;

    @Field(() => InformedConsentVersion)
    @ManyToOne(() => InformedConsentVersion, version => version.questions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'versionId' })
    version: InformedConsentVersion;

    @Field(() => [InformedConsentAnswerOption], { nullable: true })
    @OneToMany(() => InformedConsentAnswerOption, option => option.question)
    answerOptions?: InformedConsentAnswerOption[];
}
