import { FilterableField, FilterableRelation, FilterableUnPagedRelation } from '@nestjs-query/query-graphql';
import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
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
    Unique,
    UpdateDateColumn,
} from 'typeorm';
import { InformedConsentVersionStatus } from '../enums/informed-consent-version-status.enum';
import { InformedConsentModel } from './informed-consent-model.model';
import { InformedConsentQuestion } from './informed-consent-question.model';
import { InformedConsentTextBlock } from './informed-consent-text-block.model';

@ObjectType()
@FilterableRelation('model', () => InformedConsentModel)
@FilterableUnPagedRelation('textBlocks', () => InformedConsentTextBlock, { nullable: true })
@FilterableUnPagedRelation('questions', () => InformedConsentQuestion, { nullable: true })
@Entity()
@Unique('UQ_informed_consent_version_number', ['modelId', 'versionNumber'])
export class InformedConsentVersion extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => Int)
    @Column()
    modelId: number;

    @FilterableField(() => Int)
    @Column()
    versionNumber: number;

    @FilterableField()
    @Column()
    title: string;

    @FilterableField(() => InformedConsentVersionStatus)
    @Column({ type: 'varchar', default: InformedConsentVersionStatus.DRAFT })
    status: InformedConsentVersionStatus;

    @Field({ nullable: true })
    @Column({ type: 'text', nullable: true })
    notes?: string;

    @FilterableField()
    @Column({ default: 'Registrar respuesta' })
    submitButtonLabel: string;

    @Field({ nullable: true })
    @Column({ type: 'text', nullable: true })
    thankYouHtml?: string;

    @FilterableField(() => GraphQLISODateTime, { nullable: true })
    @Column({ nullable: true })
    publishedAt?: Date;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    createdById?: number;

    @FilterableField(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @FilterableField(() => GraphQLISODateTime)
    @UpdateDateColumn()
    updatedAt: Date;

    @Field(() => InformedConsentModel)
    @ManyToOne(() => InformedConsentModel, model => model.versions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'modelId' })
    model: InformedConsentModel;

    @Field(() => [InformedConsentTextBlock], { nullable: true })
    @OneToMany(() => InformedConsentTextBlock, block => block.version)
    textBlocks?: InformedConsentTextBlock[];

    @Field(() => [InformedConsentQuestion], { nullable: true })
    @OneToMany(() => InformedConsentQuestion, question => question.version)
    questions?: InformedConsentQuestion[];

    @Field(() => User, { nullable: true })
    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'createdById' })
    createdBy?: User;
}
