import { FilterableField, FilterableRelation } from '@nestjs-query/query-graphql';
import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import { Assessment } from 'src/modules/assessment/models/assessment.model';
import { ClinicalSession } from 'src/modules/clinical-session/models/clinical-session.model';
import { Patient } from 'src/modules/patient/models/patient.model';
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
    UpdateDateColumn,
} from 'typeorm';
import { TreatmentCycleKind } from '../enums/treatment-cycle-kind.enum';
import { TreatmentCycleStatus } from '../enums/treatment-cycle-status.enum';
import { CaseEventReason } from './case-event-reason.model';

@ObjectType()
@FilterableRelation('patient', () => Patient, { nullable: true })
@FilterableRelation('therapist', () => User, { nullable: true })
@FilterableRelation('finalizationReason', () => CaseEventReason, { nullable: true })
@FilterableRelation('newTreatmentReason', () => CaseEventReason, { nullable: true })
@FilterableRelation('lastClinicalSession', () => ClinicalSession, { nullable: true })
@Entity()
export class TreatmentCycle extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => TreatmentCycleKind)
    @Column({ type: 'enum', enum: TreatmentCycleKind, enumName: 'treatment_cycle_kind_enum' })
    cycleKind: TreatmentCycleKind;

    @FilterableField(() => TreatmentCycleStatus)
    @Column({
        type: 'enum',
        enum: TreatmentCycleStatus,
        enumName: 'treatment_cycle_status_enum',
        default: TreatmentCycleStatus.ACTIVE,
    })
    status: TreatmentCycleStatus;

    @FilterableField(() => Int)
    @Column()
    cycleNumber: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    patientId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    therapistId?: number;

    @FilterableField(() => GraphQLISODateTime)
    @Column()
    startedAt: Date;

    @FilterableField(() => GraphQLISODateTime, { nullable: true })
    @Column({ nullable: true })
    finalizedAt?: Date;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    finalizationReasonId?: number;

    @Field(() => String, { nullable: true })
    @Column({ type: 'text', nullable: true })
    finalizationReasonSnapshot?: string;

    @Field(() => String, { nullable: true })
    @Column({ type: 'text', nullable: true })
    finalizationOtherReason?: string;

    @Field(() => String, { nullable: true })
    @Column({ type: 'text', nullable: true })
    finalizationNote?: string;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    newTreatmentReasonId?: number;

    @Field(() => String, { nullable: true })
    @Column({ type: 'text', nullable: true })
    newTreatmentReasonSnapshot?: string;

    @Field(() => String, { nullable: true })
    @Column({ type: 'text', nullable: true })
    newTreatmentOtherReason?: string;

    @Field(() => String, { nullable: true })
    @Column({ type: 'text', nullable: true })
    newTreatmentNote?: string;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    daysSincePreviousFinalization?: number;

    @FilterableField(() => Int)
    @Column({ default: 0 })
    previousCycleCount: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    lastClinicalSessionId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    lastSessionNumber?: number;

    @FilterableField(() => GraphQLISODateTime, { nullable: true })
    @Column({ nullable: true })
    finalizationCancelledAt?: Date;

    @Field(() => String, { nullable: true })
    @Column({ type: 'text', nullable: true })
    finalizationCancellationNote?: string;

    @FilterableField(() => GraphQLISODateTime, { nullable: true })
    @Column({ nullable: true })
    finalizationUndoExpiresAt?: Date;

    @Column({ type: 'jsonb', nullable: true })
    finalizationSnapshot?: any;

    @Field(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @Field(() => GraphQLISODateTime)
    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => Patient, { nullable: true })
    @JoinColumn({ name: 'patientId' })
    patient?: Patient;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'therapistId' })
    therapist?: User;

    @ManyToOne(() => CaseEventReason, { nullable: true })
    @JoinColumn({ name: 'finalizationReasonId' })
    finalizationReason?: CaseEventReason;

    @ManyToOne(() => CaseEventReason, { nullable: true })
    @JoinColumn({ name: 'newTreatmentReasonId' })
    newTreatmentReason?: CaseEventReason;

    @ManyToOne(() => ClinicalSession, { nullable: true })
    @JoinColumn({ name: 'lastClinicalSessionId' })
    lastClinicalSession?: ClinicalSession;

    @OneToMany(() => ClinicalSession, session => session.treatmentCycle)
    clinicalSessions?: ClinicalSession[];

    @OneToMany(() => Assessment, assessment => assessment.treatmentCycle)
    assessments?: Assessment[];
}
