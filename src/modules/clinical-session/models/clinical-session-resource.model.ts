import { FilterableField, FilterableRelation } from '@nestjs-query/query-graphql';
import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import { Assessment } from 'src/modules/assessment/models/assessment.model';
import { ResourceActivationAnchor } from 'src/modules/evaluation-scheme/enums/resource-activation-anchor.enum';
import { SchemeResourceTemplate } from 'src/modules/evaluation-scheme/models/scheme-resource-template.model';
import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { ClinicalSessionResourceKind } from '../enums/clinical-session-resource-kind.enum';
import { ClinicalSessionResourceStatus } from '../enums/clinical-session-resource-status.enum';
import { ClinicalSessionSchemeApplication } from './clinical-session-scheme-application.model';
import { ClinicalSession } from './clinical-session.model';

@ObjectType()
@FilterableRelation('clinicalSession', () => ClinicalSession)
@FilterableRelation('resourceTemplate', () => SchemeResourceTemplate, { nullable: true })
@FilterableRelation('assessment', () => Assessment, { nullable: true })
@Entity()
export class ClinicalSessionResource extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => Int)
    @Column()
    clinicalSessionId: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    resourceTemplateId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    assessmentId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    schemeApplicationId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    schemeRelativeSessionNumber?: number;

    @FilterableField(() => ClinicalSessionResourceKind)
    @Column({ type: 'enum', enum: ClinicalSessionResourceKind })
    resourceKind: ClinicalSessionResourceKind;

    @Field({ nullable: true })
    @Column({ nullable: true })
    name?: string;

    @FilterableField(() => ClinicalSessionResourceStatus)
    @Column({
        type: 'enum',
        enum: ClinicalSessionResourceStatus,
        default: ClinicalSessionResourceStatus.PENDING,
    })
    status: ClinicalSessionResourceStatus;

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

    @FilterableField(() => GraphQLISODateTime, { nullable: true })
    @Column({ nullable: true })
    activationAt?: Date;

    @FilterableField(() => GraphQLISODateTime, { nullable: true })
    @Column({ nullable: true })
    expirationAt?: Date;

    @Field(() => GraphQLISODateTime, { nullable: true })
    @Column({ nullable: true })
    detachedAt?: Date;

    @Field({ nullable: true })
    @Column({ nullable: true })
    detachedReason?: string;

    @Field(() => Int, { nullable: true })
    @Column({ nullable: true })
    replacementResourceId?: number;

    @Field(() => Int, { nullable: true })
    @Column({ nullable: true })
    replacedResourceId?: number;

    @FilterableField(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @FilterableField(() => GraphQLISODateTime)
    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => ClinicalSession, session => session.resources)
    clinicalSession: ClinicalSession;

    @ManyToOne(() => SchemeResourceTemplate, { nullable: true })
    resourceTemplate?: SchemeResourceTemplate;

    @OneToOne(() => Assessment, { nullable: true })
    @JoinColumn({ name: 'assessmentId' })
    assessment?: Assessment;

    @ManyToOne(() => ClinicalSessionSchemeApplication, { nullable: true })
    schemeApplication?: ClinicalSessionSchemeApplication;
}
