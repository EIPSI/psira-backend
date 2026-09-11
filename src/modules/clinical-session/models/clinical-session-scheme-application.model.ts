import {
    FilterableField,
    FilterableRelation,
} from '@nestjs-query/query-graphql';
import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import { EvaluationScheme } from 'src/modules/evaluation-scheme/models/evaluation-scheme.model';
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
import { ClinicalSessionKind } from '../enums/clinical-session-kind.enum';
import { ClinicalSessionSchemeApplicationMode } from '../enums/clinical-session-scheme-application-mode.enum';
import { ClinicalSessionSchemeApplicationStatus } from '../enums/clinical-session-scheme-application-status.enum';
import { ClinicalSession } from './clinical-session.model';

@ObjectType()
@FilterableRelation('scheme', () => EvaluationScheme)
@FilterableRelation('patient', () => Patient, { nullable: true })
@FilterableRelation('therapist', () => User, { nullable: true })
@FilterableRelation('startSession', () => ClinicalSession)
@FilterableRelation('stoppedAtSession', () => ClinicalSession, { nullable: true })
@Entity()
export class ClinicalSessionSchemeApplication extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => Int)
    @Column()
    schemeId: number;

    @FilterableField(() => ClinicalSessionKind)
    @Column({ type: 'enum', enum: ClinicalSessionKind })
    sessionKind: ClinicalSessionKind;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    patientId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    therapistId?: number;

    @FilterableField(() => Int)
    @Column()
    startClinicalSessionId: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    startSessionNumber?: number;

    @FilterableField(() => ClinicalSessionSchemeApplicationMode)
    @Column({
        type: 'enum',
        enum: ClinicalSessionSchemeApplicationMode,
        enumName: 'clinical_session_scheme_application_mode_enum',
    })
    applicationMode: ClinicalSessionSchemeApplicationMode;

    @FilterableField(() => ClinicalSessionSchemeApplicationStatus)
    @Column({
        type: 'enum',
        enum: ClinicalSessionSchemeApplicationStatus,
        enumName: 'clinical_session_scheme_application_status_enum',
        default: ClinicalSessionSchemeApplicationStatus.ACTIVE,
    })
    status: ClinicalSessionSchemeApplicationStatus;

    @Field(() => Int, { nullable: true })
    @Column({ nullable: true })
    stoppedAtClinicalSessionId?: number;

    @Field(() => Int, { nullable: true })
    @Column({ nullable: true })
    createdByUserId?: number;

    @FilterableField(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @FilterableField(() => GraphQLISODateTime)
    @UpdateDateColumn()
    updatedAt: Date;

    @Field(() => EvaluationScheme)
    @ManyToOne(() => EvaluationScheme)
    scheme: EvaluationScheme;

    @Field(() => Patient, { nullable: true })
    @ManyToOne(() => Patient, { nullable: true })
    patient?: Patient;

    @Field(() => User, { nullable: true })
    @ManyToOne(() => User, { nullable: true })
    therapist?: User;

    @Field(() => ClinicalSession)
    @ManyToOne(() => ClinicalSession)
    @JoinColumn({ name: 'startClinicalSessionId' })
    startSession: ClinicalSession;

    @Field(() => ClinicalSession, { nullable: true })
    @ManyToOne(() => ClinicalSession, { nullable: true })
    @JoinColumn({ name: 'stoppedAtClinicalSessionId' })
    stoppedAtSession?: ClinicalSession;
}
