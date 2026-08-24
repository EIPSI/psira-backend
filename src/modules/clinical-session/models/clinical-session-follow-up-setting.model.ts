import { FilterableField } from '@nestjs-query/query-graphql';
import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import {
    BaseEntity,
    Column,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

@ObjectType()
@Entity()
export class ClinicalSessionFollowUpSetting extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @Field(() => Int)
    @Column({ default: 7 })
    editWindowDays: number;

    @Field(() => GraphQLISODateTime)
    @UpdateDateColumn()
    updatedAt: Date;
}
