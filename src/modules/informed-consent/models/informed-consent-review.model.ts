import { FilterableField, FilterableRelation } from '@nestjs-query/query-graphql';
import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import { User } from 'src/modules/user/models/user.model';
import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { InformedConsentReviewAction } from '../enums/informed-consent-review-action.enum';
import { InformedConsentResponse } from './informed-consent-response.model';

@ObjectType()
@FilterableRelation('response', () => InformedConsentResponse)
@FilterableRelation('reviewer', () => User)
@Entity()
export class InformedConsentReview extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => Int)
    @Column()
    responseId: number;

    @FilterableField(() => Int)
    @Column()
    reviewerUserId: number;

    @FilterableField(() => InformedConsentReviewAction)
    @Column({ type: 'varchar' })
    action: InformedConsentReviewAction;

    @Field()
    @Column({ type: 'text' })
    reason: string;

    @Field({ nullable: true })
    @Column({ type: 'text', nullable: true })
    comment?: string;

    @FilterableField(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @Field(() => InformedConsentResponse)
    @ManyToOne(() => InformedConsentResponse, response => response.reviews, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'responseId' })
    response: InformedConsentResponse;

    @Field(() => User)
    @ManyToOne(() => User)
    @JoinColumn({ name: 'reviewerUserId' })
    reviewer: User;
}
