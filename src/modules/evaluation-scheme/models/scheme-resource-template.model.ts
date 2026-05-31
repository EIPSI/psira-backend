import { FilterableField, FilterableRelation } from '@nestjs-query/query-graphql';
import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import { ClinicalSessionResourceKind } from 'src/modules/clinical-session/enums/clinical-session-resource-kind.enum';
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
import { ResourceActivationAnchor } from '../enums/resource-activation-anchor.enum';
import { SchemeSessionTemplate } from './scheme-session-template.model';

@ObjectType()
@FilterableRelation('sessionTemplate', () => SchemeSessionTemplate)
@FilterableRelation('assessmentType', () => AssessmentType, { nullable: true })
@Entity()
export class SchemeResourceTemplate extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => Int)
    @Column()
    sessionTemplateId: number;

    @FilterableField(() => ClinicalSessionResourceKind)
    @Column({ type: 'enum', enum: ClinicalSessionResourceKind })
    resourceKind: ClinicalSessionResourceKind;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    assessmentTypeId?: number;

    @Field(() => [String], { nullable: true })
    @Column({ type: 'simple-json', nullable: true })
    questionnaireIds?: string[];

    @Field(() => [String], { nullable: true })
    @Column({ type: 'simple-json', nullable: true })
    questionnaireBundleIds?: string[];

    @Field({ nullable: true })
    @Column({ nullable: true })
    sessionSelector?: string;

    @Field(() => Int, { nullable: true })
    @Column({ nullable: true })
    everyNSessions?: number;

    @Field(() => Int, { nullable: true })
    @Column({ nullable: true })
    startSessionNumber?: number;

    @Field(() => Int, { nullable: true })
    @Column({ nullable: true })
    endSessionNumber?: number;

    @Field({ nullable: true })
    @Column({ nullable: true, default: AssessmentInformant.PATIENT })
    informantType?: string;

    @Field({ nullable: true })
    @Column({ nullable: true })
    defaultResponderRole?: string;

    @FilterableField(() => ResourceActivationAnchor, { nullable: true })
    @Column({ type: 'enum', enum: ResourceActivationAnchor, nullable: true })
    activationAnchor?: ResourceActivationAnchor;

    @Field(() => Int, { nullable: true })
    @Column({ nullable: true })
    activationOffsetMinutes?: number;

    @Field(() => Int, { nullable: true })
    @Column({ nullable: true })
    availabilityDurationMinutes?: number;

    @Field(() => [Int], { nullable: true })
    @Column({ type: 'simple-json', nullable: true })
    reminderMinutes?: number[];

    @FilterableField(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @FilterableField(() => GraphQLISODateTime)
    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(
        () => SchemeSessionTemplate,
        sessionTemplate => sessionTemplate.resourceTemplates,
    )
    sessionTemplate: SchemeSessionTemplate;

    @ManyToOne(() => AssessmentType, { nullable: true })
    assessmentType?: AssessmentType;
}
