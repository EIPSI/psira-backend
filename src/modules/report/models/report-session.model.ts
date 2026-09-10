import { FilterableField, FilterableRelation } from '@nestjs-query/query-graphql';
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
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { Report } from './report.model';

@ObjectType()
@FilterableRelation('report', () => Report, { nullable: true })
@FilterableRelation('user', () => User, { nullable: true })
@FilterableRelation('patient', () => Patient, { nullable: true })
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

    @FilterableField({ nullable: true })
    @Column({ nullable: true })
    contextType?: string;

    @Field({ nullable: true })
    @Column({ type: 'text', nullable: true })
    contextParams?: string;

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

    @FilterableField({ nullable: true })
    @Column({ nullable: true })
    closedBy?: string;

    @Field(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @Field(() => GraphQLISODateTime)
    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => Report)
    @JoinColumn({ name: 'reportId' })
    @Field(() => Report, { nullable: true })
    report: Report;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'userId' })
    @Field(() => User, { nullable: true })
    user: User;

    @ManyToOne(() => Patient, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'patientId' })
    @Field(() => Patient, { nullable: true })
    patient?: Patient;
}
