import { FilterableField } from '@nestjs-query/query-graphql';
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
import { Report } from './report.model';

@ObjectType()
@Entity()
export class ReportSession extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => Int)
    @Column()
    reportId: number;

    @FilterableField(() => Int)
    @Column()
    userId: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    patientId?: number;

    @FilterableField(() => GraphQLISODateTime)
    @Column()
    startedAt: Date;

    @FilterableField(() => GraphQLISODateTime)
    @Column()
    lastSeenAt: Date;

    @FilterableField(() => GraphQLISODateTime, { nullable: true })
    @Column({ nullable: true })
    endedAt?: Date;

    @Field(() => Int)
    @Column({ default: 0 })
    durationSeconds: number;

    @Field(() => Boolean)
    @Column({ default: true })
    active: boolean;

    @Field(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @Field(() => GraphQLISODateTime)
    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => Report)
    @Field(() => Report, { nullable: true })
    report: Report;

    @ManyToOne(() => User)
    user: User;
}
