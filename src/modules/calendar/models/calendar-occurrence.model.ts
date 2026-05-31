import {
    FilterableField,
    FilterableRelation,
    FilterableUnPagedRelation,
} from '@nestjs-query/query-graphql';
import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import { Assessment } from 'src/modules/assessment/models/assessment.model';
import { ClinicalSession } from 'src/modules/clinical-session/models/clinical-session.model';
import { EvaluationSchemeAssignment } from 'src/modules/evaluation-scheme/models/evaluation-scheme-assignment.model';
import { EvaluationScheme } from 'src/modules/evaluation-scheme/models/evaluation-scheme.model';
import { Patient } from 'src/modules/patient/models/patient.model';
import { User } from 'src/modules/user/models/user.model';
import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    OneToMany,
    OneToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { CalendarOccurrenceStatus } from '../enums/calendar-occurrence-status.enum';
import { CalendarOccurrenceType } from '../enums/calendar-occurrence-type.enum';

@ObjectType()
@FilterableRelation('scheme', () => EvaluationScheme, { nullable: true })
@FilterableRelation('schemeAssignment', () => EvaluationSchemeAssignment, { nullable: true })
@FilterableRelation('patient', () => Patient, { nullable: true })
@FilterableRelation('therapist', () => User, { nullable: true })
@FilterableRelation('supervisor', () => User, { nullable: true })
@FilterableRelation('clinicalSession', () => ClinicalSession, { nullable: true })
@FilterableUnPagedRelation('assessments', () => Assessment, { nullable: true })
@Entity()
export class CalendarOccurrence extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => CalendarOccurrenceType)
    @Column({ type: 'enum', enum: CalendarOccurrenceType })
    occurrenceType: CalendarOccurrenceType;

    @FilterableField()
    @Column()
    title: string;

    @FilterableField(() => GraphQLISODateTime)
    @Column()
    startAt: Date;

    @FilterableField(() => GraphQLISODateTime)
    @Column()
    endAt: Date;

    @FilterableField()
    @Column({ default: 'UTC' })
    timezone: string;

    @FilterableField(() => CalendarOccurrenceStatus)
    @Column({
        type: 'enum',
        enum: CalendarOccurrenceStatus,
        default: CalendarOccurrenceStatus.SCHEDULED,
    })
    status: CalendarOccurrenceStatus;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    schemeId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    schemeAssignmentId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    patientId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    therapistId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    supervisorId?: number;

    @FilterableField()
    @Column({ default: false })
    isDetachedFromTemplate: boolean;

    @Field(() => Int, { nullable: true })
    @Column({ nullable: true })
    templateVersion?: number;

    @Field(() => GraphQLISODateTime, { nullable: true })
    @Column({ nullable: true })
    originalStartAt?: Date;

    @Field({ nullable: true })
    @Column({ nullable: true })
    cancellationReason?: string;

    @Field({ nullable: true })
    @Column({ nullable: true })
    notes?: string;

    @FilterableField(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @FilterableField(() => GraphQLISODateTime)
    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => EvaluationScheme, { nullable: true })
    scheme?: EvaluationScheme;

    @ManyToOne(
        () => EvaluationSchemeAssignment,
        assignment => assignment.occurrences,
        { nullable: true },
    )
    schemeAssignment?: EvaluationSchemeAssignment;

    @ManyToOne(() => Patient, { nullable: true })
    patient?: Patient;

    @ManyToOne(() => User, { nullable: true })
    therapist?: User;

    @ManyToOne(() => User, { nullable: true })
    supervisor?: User;

    @OneToOne(() => ClinicalSession, session => session.calendarOccurrence)
    clinicalSession?: ClinicalSession;

    @OneToMany(() => Assessment, assessment => assessment.calendarOccurrence)
    assessments: Assessment[];
}
