import {
    FilterableField,
    FilterableRelation,
    FilterableUnPagedRelation,
} from '@nestjs-query/query-graphql';
import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import { CalendarOccurrence } from 'src/modules/calendar/models/calendar-occurrence.model';
import { SchemeSessionTemplate } from 'src/modules/evaluation-scheme/models/scheme-session-template.model';
import { Patient } from 'src/modules/patient/models/patient.model';
import { User } from 'src/modules/user/models/user.model';
import { TreatmentCycle } from 'src/modules/treatment-cycle/models/treatment-cycle.model';
import { CaseEventReason } from 'src/modules/treatment-cycle/models/case-event-reason.model';
import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    ManyToMany,
    OneToMany,
    OneToOne,
    PrimaryGeneratedColumn,
    JoinTable,
    UpdateDateColumn,
} from 'typeorm';
import { ClinicalSessionKind } from '../enums/clinical-session-kind.enum';
import { ClinicalSessionStatus } from '../enums/clinical-session-status.enum';
import { ClinicalSessionCancellationLabel } from '../enums/clinical-session-cancellation-label.enum';
import { ClinicalSessionCancellationType } from '../enums/clinical-session-cancellation-type.enum';
import { ClinicalSessionModality } from '../enums/clinical-session-modality.enum';
import { ClinicalSessionResource } from './clinical-session-resource.model';

@ObjectType()
@FilterableRelation('calendarOccurrence', () => CalendarOccurrence)
@FilterableRelation('sessionTemplate', () => SchemeSessionTemplate, { nullable: true })
@FilterableRelation('patient', () => Patient, { nullable: true })
@FilterableRelation('therapist', () => User, { nullable: true })
@FilterableRelation('supervisor', () => User, { nullable: true })
@FilterableRelation('treatmentCycle', () => TreatmentCycle, { nullable: true })
@FilterableRelation('cancellationReasonTreeNode', () => CaseEventReason, { nullable: true })
@FilterableUnPagedRelation('responsibleUsers', () => User, { nullable: true })
@FilterableUnPagedRelation('resources', () => ClinicalSessionResource, { nullable: true })
@Entity()
export class ClinicalSession extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => Int)
    @Column()
    calendarOccurrenceId: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    sessionTemplateId?: number;

    @FilterableField(() => ClinicalSessionKind)
    @Column({ type: 'enum', enum: ClinicalSessionKind })
    sessionKind: ClinicalSessionKind;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    sessionNumber?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    patientId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    therapistId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    supervisorId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    treatmentCycleId?: number;

    @FilterableField(() => ClinicalSessionModality)
    @Column({
        type: 'enum',
        enum: ClinicalSessionModality,
        enumName: 'clinical_session_modality_enum',
        default: ClinicalSessionModality.IN_PERSON,
    })
    modality: ClinicalSessionModality;

    @FilterableField(() => ClinicalSessionCancellationType, { nullable: true })
    @Column({
        type: 'enum',
        enum: ClinicalSessionCancellationType,
        enumName: 'clinical_session_cancellation_type_enum',
        nullable: true,
    })
    cancellationType?: ClinicalSessionCancellationType;

    @FilterableField(() => ClinicalSessionCancellationLabel, { nullable: true })
    @Column({
        type: 'enum',
        enum: ClinicalSessionCancellationLabel,
        enumName: 'clinical_session_cancellation_label_enum',
        nullable: true,
    })
    cancellationLabel?: ClinicalSessionCancellationLabel;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    cancellationReasonId?: number;

    @Field(() => String, { nullable: true })
    @Column({ type: 'text', nullable: true })
    cancellationReasonSnapshot?: string;

    @Field(() => String, { nullable: true })
    @Column({ type: 'text', nullable: true })
    cancellationComment?: string;

    @Field(() => GraphQLISODateTime, { nullable: true })
    @Column({ nullable: true })
    cancelledAt?: Date;

    @Field(() => Int, { nullable: true })
    @Column({ nullable: true })
    cancelledSessionNumber?: number;

    @Field(() => GraphQLISODateTime, { nullable: true })
    @Column({ nullable: true })
    cancelledStartAt?: Date;

    @FilterableField(() => ClinicalSessionStatus)
    @Column({
        type: 'enum',
        enum: ClinicalSessionStatus,
        default: ClinicalSessionStatus.SCHEDULED,
    })
    clinicalStatus: ClinicalSessionStatus;

    @Field(() => String, { nullable: true })
    @Column({ type: 'text', nullable: true })
    clinicalHistory?: string;

    @Field(() => String)
    get historyLabel(): string {
        return this.sessionKind === ClinicalSessionKind.SUPERVISION
            ? 'Seguimiento de Supervisión'
            : 'Seguimiento Clínico';
    }

    @FilterableField(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @FilterableField(() => GraphQLISODateTime)
    @UpdateDateColumn()
    updatedAt: Date;

    @OneToOne(
        () => CalendarOccurrence,
        occurrence => occurrence.clinicalSession,
    )
    @JoinColumn()
    calendarOccurrence: CalendarOccurrence;

    @ManyToOne(() => SchemeSessionTemplate, { nullable: true })
    sessionTemplate?: SchemeSessionTemplate;

    @ManyToOne(() => Patient, { nullable: true })
    patient?: Patient;

    @ManyToOne(() => User, { nullable: true })
    therapist?: User;

    @ManyToOne(() => User, { nullable: true })
    supervisor?: User;

    @ManyToOne(() => TreatmentCycle, cycle => cycle.clinicalSessions, { nullable: true })
    @JoinColumn({ name: 'treatmentCycleId' })
    treatmentCycle?: TreatmentCycle;

    @ManyToOne(() => CaseEventReason, { nullable: true })
    @JoinColumn({ name: 'cancellationReasonId' })
    cancellationReasonTreeNode?: CaseEventReason;

    @ManyToMany(() => User)
    @JoinTable({ name: 'clinical_session_responsible_user' })
    responsibleUsers?: User[];

    @OneToMany(() => ClinicalSessionResource, resource => resource.clinicalSession)
    resources: ClinicalSessionResource[];
}
