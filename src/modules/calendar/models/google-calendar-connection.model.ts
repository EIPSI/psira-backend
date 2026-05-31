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

@ObjectType()
@FilterableRelation('user', () => User)
@Entity()
export class GoogleCalendarConnection extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => Int)
    @Column()
    userId: number;

    @FilterableField()
    @Column({ default: 'primary' })
    calendarId: string;

    @Column({ type: 'text' })
    accessToken: string;

    @Column({ type: 'text', nullable: true })
    refreshToken?: string;

    @Field(() => GraphQLISODateTime, { nullable: true })
    @Column({ nullable: true })
    tokenExpiresAt?: Date;

    @FilterableField()
    @Column({ default: true })
    syncEnabled: boolean;

    @FilterableField(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @FilterableField(() => GraphQLISODateTime)
    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => User)
    user: User;
}
