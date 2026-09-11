/* eslint-disable @typescript-eslint/no-use-before-define */
import {
    FilterableField,
    FilterableRelation,
    FilterableUnPagedRelation,
} from '@nestjs-query/query-graphql';
import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

@ObjectType()
@FilterableRelation('parent', () => ClinicalSessionCancellationReason, {
    nullable: true,
})
@FilterableUnPagedRelation('children', () => ClinicalSessionCancellationReason, {
    nullable: true,
})
@Entity()
export class ClinicalSessionCancellationReason extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField()
    @Column()
    label: string;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    parentId?: number;

    @FilterableField()
    @Column({ default: true })
    active: boolean;

    @FilterableField(() => Int)
    @Column({ default: 0 })
    sortOrder: number;

    @Field(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @Field(() => GraphQLISODateTime)
    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(
        () => ClinicalSessionCancellationReason,
        reason => reason.children,
        { nullable: true },
    )
    parent?: ClinicalSessionCancellationReason;

    @OneToMany(
        () => ClinicalSessionCancellationReason,
        reason => reason.parent,
    )
    children?: ClinicalSessionCancellationReason[];
}
