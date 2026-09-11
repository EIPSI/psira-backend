import { FilterableField, FilterableRelation, FilterableUnPagedRelation } from '@nestjs-query/query-graphql';
import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import { Patient } from 'src/modules/patient/models/patient.model';
import { User } from 'src/modules/user/models/user.model';
import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { InformedConsentAnswerResolution } from '../enums/informed-consent-answer-resolution.enum';
import { InformedConsentResponseStatus } from '../enums/informed-consent-response-status.enum';
import { InformedConsentManagement } from './informed-consent-management.model';
import { InformedConsentModel } from './informed-consent-model.model';
import { InformedConsentResponseAnswer } from './informed-consent-response-answer.model';
import { InformedConsentReview } from './informed-consent-review.model';
import { InformedConsentVersion } from './informed-consent-version.model';

@ObjectType()
@FilterableRelation('management', () => InformedConsentManagement, { nullable: true })
@FilterableRelation('model', () => InformedConsentModel)
@FilterableRelation('version', () => InformedConsentVersion)
@FilterableRelation('signer', () => User)
@FilterableRelation('representedUser', () => User, { nullable: true })
@FilterableRelation('patient', () => Patient, { nullable: true })
@FilterableUnPagedRelation('answers', () => InformedConsentResponseAnswer, { nullable: true })
@FilterableUnPagedRelation('reviews', () => InformedConsentReview, { nullable: true })
@Entity()
export class InformedConsentResponse extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    managementId?: number;

    @FilterableField(() => Int)
    @Column()
    modelId: number;

    @FilterableField(() => Int)
    @Column()
    versionId: number;

    @FilterableField(() => Int)
    @Column()
    signerUserId: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    representedUserId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    patientId?: number;

    @FilterableField(() => InformedConsentResponseStatus)
    @Column({ type: 'varchar', default: InformedConsentResponseStatus.PENDING })
    status: InformedConsentResponseStatus;

    @FilterableField(() => InformedConsentAnswerResolution, { nullable: true })
    @Column({ type: 'varchar', nullable: true })
    finalResolution?: InformedConsentAnswerResolution;

    @FilterableField()
    @Column({ default: false })
    mandatorySnapshot: boolean;

    @Column({ type: 'jsonb', nullable: true })
    modelSnapshot?: any;

    @Column({ type: 'jsonb', nullable: true })
    responseSnapshot?: any;

    @FilterableField(() => GraphQLISODateTime, { nullable: true })
    @Column({ nullable: true })
    answeredAt?: Date;

    @FilterableField(() => GraphQLISODateTime, { nullable: true })
    @Column({ nullable: true })
    blockedAt?: Date;

    @Field({ nullable: true })
    @Column({ nullable: true })
    ipAddress?: string;

    @Field({ nullable: true })
    @Column({ type: 'text', nullable: true })
    userAgent?: string;

    @Field({ nullable: true })
    @Column({ nullable: true })
    language?: string;

    @FilterableField(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @FilterableField(() => GraphQLISODateTime)
    @UpdateDateColumn()
    updatedAt: Date;

    @Field(() => InformedConsentManagement, { nullable: true })
    @ManyToOne(() => InformedConsentManagement, { nullable: true })
    @JoinColumn({ name: 'managementId' })
    management?: InformedConsentManagement;

    @Field(() => InformedConsentModel)
    @ManyToOne(() => InformedConsentModel)
    @JoinColumn({ name: 'modelId' })
    model: InformedConsentModel;

    @Field(() => InformedConsentVersion)
    @ManyToOne(() => InformedConsentVersion)
    @JoinColumn({ name: 'versionId' })
    version: InformedConsentVersion;

    @Field(() => User)
    @ManyToOne(() => User)
    @JoinColumn({ name: 'signerUserId' })
    signer: User;

    @Field(() => User, { nullable: true })
    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'representedUserId' })
    representedUser?: User;

    @Field(() => Patient, { nullable: true })
    @ManyToOne(() => Patient, { nullable: true })
    @JoinColumn({ name: 'patientId' })
    patient?: Patient;

    @Field(() => [InformedConsentResponseAnswer], { nullable: true })
    @OneToMany(() => InformedConsentResponseAnswer, answer => answer.response)
    answers?: InformedConsentResponseAnswer[];

    @Field(() => [InformedConsentReview], { nullable: true })
    @OneToMany(() => InformedConsentReview, review => review.response)
    reviews?: InformedConsentReview[];
}
