import {
    FilterableField,
    FilterableRelation,
} from '@nestjs-query/query-graphql';
import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import { User } from 'src/modules/user/models/user.model';
import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { CalendarOccurrence } from './calendar-occurrence.model';

@ObjectType()
@FilterableRelation('occurrence', () => CalendarOccurrence)
@FilterableRelation('user', () => User)
@Entity()
export class CalendarExternalEvent extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => Int)
    @Column()
    occurrenceId: number;

    @FilterableField(() => Int)
    @Column()
    userId: number;

    @FilterableField()
    @Column({ default: 'GOOGLE' })
    provider: string;

    @FilterableField()
    @Column()
    externalEventId: string;

    @Field(() => GraphQLISODateTime, { nullable: true })
    @Column({ nullable: true })
    externalUpdatedAt?: Date;

    @Field(() => GraphQLISODateTime, { nullable: true })
    @Column({ nullable: true })
    lastSyncedAt?: Date;

    @FilterableField(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @FilterableField(() => GraphQLISODateTime)
    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => CalendarOccurrence)
    occurrence: CalendarOccurrence;

    @ManyToOne(() => User)
    user: User;
}
