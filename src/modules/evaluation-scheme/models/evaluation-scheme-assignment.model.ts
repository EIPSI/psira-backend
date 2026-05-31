import { FilterableField, FilterableRelation } from '@nestjs-query/query-graphql';
import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import { CalendarOccurrence } from 'src/modules/calendar/models/calendar-occurrence.model';
import { Patient } from 'src/modules/patient/models/patient.model';
import { User } from 'src/modules/user/models/user.model';
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
import { EvaluationSchemeAssignmentStatus } from '../enums/evaluation-scheme-assignment-status.enum';
import { EvaluationScheme } from './evaluation-scheme.model';

@ObjectType()
@FilterableRelation('scheme', () => EvaluationScheme)
@FilterableRelation('patient', () => Patient, { nullable: true })
@FilterableRelation('targetUser', () => User, { nullable: true })
@FilterableRelation('therapist', () => User, { nullable: true })
@FilterableRelation('supervisor', () => User, { nullable: true })
@Entity()
export class EvaluationSchemeAssignment extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => Int)
    @Column()
    schemeId: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    patientId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    targetUserId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    therapistId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    supervisorId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    responderUserId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    clinicianId?: number;

    @FilterableField(() => GraphQLISODateTime)
    @Column()
    startDate: Date;

    @FilterableField()
    @Column({ default: 'UTC' })
    timezone: string;

    @FilterableField(() => EvaluationSchemeAssignmentStatus)
    @Column({
        type: 'enum',
        enum: EvaluationSchemeAssignmentStatus,
        default: EvaluationSchemeAssignmentStatus.ACTIVE,
    })
    status: EvaluationSchemeAssignmentStatus;

    @Field(() => Int)
    @Column({ default: 12 })
    maxFutureOccurrences: number;

    @Field(() => Int)
    @Column({ default: 3 })
    futureGenerationMonths: number;

    @FilterableField(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @FilterableField(() => GraphQLISODateTime)
    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => EvaluationScheme, scheme => scheme.assignments)
    scheme: EvaluationScheme;

    @ManyToOne(() => Patient, { nullable: true })
    patient?: Patient;

    @ManyToOne(() => User, { nullable: true })
    targetUser?: User;

    @ManyToOne(() => User, { nullable: true })
    therapist?: User;

    @ManyToOne(() => User, { nullable: true })
    supervisor?: User;

    @ManyToOne(() => User, { nullable: true })
    responderUser?: User;

    @ManyToOne(() => User, { nullable: true })
    clinician?: User;

    @OneToMany(
        () => CalendarOccurrence,
        occurrence => occurrence.schemeAssignment,
    )
    occurrences: CalendarOccurrence[];
}
