import { FilterableField, FilterableRelation } from '@nestjs-query/query-graphql';
import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
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
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { CaseHistoryEntryKind } from '../enums/case-history-entry-kind.enum';
import { TreatmentCycleKind } from '../enums/treatment-cycle-kind.enum';
import { TreatmentCycle } from './treatment-cycle.model';

@ObjectType()
@FilterableRelation('patient', () => Patient, { nullable: true })
@FilterableRelation('therapist', () => User, { nullable: true })
@FilterableRelation('treatmentCycle', () => TreatmentCycle, { nullable: true })
@FilterableRelation('clinicalSession', () => ClinicalSession, { nullable: true })
@Entity()
export class CaseHistoryEntry extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => CaseHistoryEntryKind)
    @Column({
        type: 'enum',
        enum: CaseHistoryEntryKind,
        enumName: 'case_history_entry_kind_enum',
    })
    entryKind: CaseHistoryEntryKind;

    @FilterableField(() => TreatmentCycleKind)
    @Column({
        type: 'enum',
        enum: TreatmentCycleKind,
        enumName: 'treatment_cycle_kind_enum',
    })
    cycleKind: TreatmentCycleKind;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    patientId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    therapistId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    treatmentCycleId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    clinicalSessionId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    sessionNumber?: number;

    @FilterableField(() => GraphQLISODateTime)
    @Column()
    occurredAt: Date;

    @Field(() => String)
    @Column()
    title: string;

    @Field(() => String, { nullable: true })
    @Column({ type: 'text', nullable: true })
    content?: string;

    @Field(() => String, { nullable: true })
    @Column({ type: 'text', nullable: true })
    reasonSnapshot?: string;

    @Field(() => Int, { nullable: true })
    assessmentId?: number;

    @Field(() => Int, { nullable: true })
    assessmentTypeId?: number;

    @Field(() => String, { nullable: true })
    questionnaireAssessmentId?: string;

    @Field(() => String, { nullable: true })
    assessmentName?: string;

    @Field(() => String, { nullable: true })
    assessmentTypeName?: string;

    @Column({ type: 'jsonb', nullable: true })
    metadata?: any;

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

    @ManyToOne(() => TreatmentCycle, { nullable: true })
    @JoinColumn({ name: 'treatmentCycleId' })
    treatmentCycle?: TreatmentCycle;

    @ManyToOne(() => ClinicalSession, { nullable: true })
    @JoinColumn({ name: 'clinicalSessionId' })
    clinicalSession?: ClinicalSession;
}
