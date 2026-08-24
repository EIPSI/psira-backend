import {
    FilterableField,
    FilterableRelation,
    FilterableUnPagedRelation,
} from '@nestjs-query/query-graphql';
import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import { Patient } from 'src/modules/patient/models/patient.model';
import { User } from 'src/modules/user/models/user.model';
import { QuestionnaireAssessment } from '../../questionnaire/models/questionnaire-assessment.schema';
import {
    BaseEntity,
    BeforeInsert,
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    JoinColumn,
    JoinTable,
    ManyToMany,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AssessmentInformant } from '../enums/assessment-informant.enum';
import { AssessmentOrigin } from '../enums/assessment-origin.enum';
import { AssessmentType } from './assessment-type.model';
import { MailTemplate } from 'src/modules/mail/models/mail-template.model';
import { CalendarOccurrence } from 'src/modules/calendar/models/calendar-occurrence.model';
import { ClinicalSession } from 'src/modules/clinical-session/models/clinical-session.model';
import { ClinicalSessionResource } from 'src/modules/clinical-session/models/clinical-session-resource.model';
import { TreatmentCycle } from 'src/modules/treatment-cycle/models/treatment-cycle.model';
import { ClinicalSessionSchemeApplication } from 'src/modules/clinical-session/models/clinical-session-scheme-application.model';
import { EvaluationSchemeAssignment } from 'src/modules/evaluation-scheme/models/evaluation-scheme-assignment.model';
import { EvaluationScheme } from 'src/modules/evaluation-scheme/models/evaluation-scheme.model';
import { SchemeResourceTemplate } from 'src/modules/evaluation-scheme/models/scheme-resource-template.model';

@ObjectType()
@FilterableRelation('patient', () => Patient, { nullable: true })
@FilterableRelation('targetUser', () => User, { nullable: true })
@FilterableRelation('responderUser', () => User, { nullable: true })
@FilterableRelation('clinician', () => User, { nullable: true })
@FilterableUnPagedRelation('responsibleUsers', () => User, { nullable: true })
@FilterableRelation('informantClinician', () => User, { nullable: true })
@FilterableRelation('assessmentType', () => AssessmentType, { nullable: true })
@FilterableRelation('calendarOccurrence', () => CalendarOccurrence, { nullable: true })
@FilterableRelation('clinicalSession', () => ClinicalSession, { nullable: true })
@FilterableRelation('clinicalSessionResource', () => ClinicalSessionResource, { nullable: true })
@FilterableRelation('treatmentCycle', () => TreatmentCycle, { nullable: true })
@FilterableRelation('scheme', () => EvaluationScheme, { nullable: true })
@FilterableRelation('schemeAssignment', () => EvaluationSchemeAssignment, { nullable: true })
@FilterableRelation('schemeResourceTemplate', () => SchemeResourceTemplate, { nullable: true })
@Entity()
export class Assessment extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @Field(() => String)
    @Column({ nullable: false })
    questionnaireAssessmentId: string;

    @FilterableField(() => GraphQLISODateTime, { nullable: true })
    @Column({ nullable: true })
    date?: Date;

    // @FilterableField({ nullable: true })
    // @Column({ nullable: true })
    // name: string;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    patientId: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    targetUserId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    responderUserId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    clinicianId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column()
    assessmentTypeId?: number;

    @FilterableField(() => String, { nullable: true })
    @Column({ nullable: true, default: AssessmentInformant.PATIENT })
    informantType?: string;

    @FilterableField({ nullable: true })
    @Column({ default: 'PLANNED' })
    status: string;

    @Field(() => String, { nullable: true })
    @Column({ nullable: true })
    note: string;

    @FilterableField(() => GraphQLISODateTime, { nullable: true })
    @Column({ nullable: true })
    expirationDate?: Date;

    @FilterableField(() => GraphQLISODateTime, { nullable: true })
    @Column({ nullable: true })
    deliveryDate?: Date;

    @FilterableField(() => GraphQLISODateTime, { nullable: true })
    @Column({ nullable: true })
    submissionDate?: Date;

    @Field(() => String, { nullable: true })
    @Column({ nullable: true })
    informantCaregiverRelation?: string;

    @FilterableField(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @FilterableField(() => GraphQLISODateTime)
    @UpdateDateColumn()
    updatedAt: Date;

    @Field(() => GraphQLISODateTime, { nullable: true })
    @DeleteDateColumn()
    deletedAt?: Date;

    @FilterableField({ nullable: true })
    @Column({ nullable: true })
    deleted: boolean

    @Field(() => Boolean)
    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @FilterableField(() => String, { nullable: true })
    @Column({ type: 'varchar', nullable: true })
    uuid: string;

    @Field(() => Boolean)
    @Column()
    emailReminder?: boolean;

    @FilterableField(() => String)
    @Column()
    emailStatus?: string;

    @Field(() => String, { nullable: true })
    @Column()
    receiverEmail?: string;

    @Field(() => Int, { nullable: true })
    @Column()
    mailTemplateId: number

    @Field(() => [Int], { nullable: true })
    @Column({ type: 'simple-json', nullable: true })
    reminderMinutes?: number[];

    @Field(() => [Int], { nullable: true })
    @Column({ type: 'simple-json', nullable: true })
    sentReminderMinutes?: number[];

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    calendarOccurrenceId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    clinicalSessionId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    clinicalSessionResourceId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    treatmentCycleId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    schemeId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    schemeAssignmentId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    schemeResourceTemplateId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    schemeApplicationId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    schemeRelativeSessionNumber?: number;

    @Field(() => GraphQLISODateTime, { nullable: true })
    @Column({ nullable: true })
    detachedFromSessionAt?: Date;

    @Field(() => String, { nullable: true })
    @Column({ nullable: true })
    detachedFromSessionReason?: string;

    @Field(() => AssessmentOrigin)
    get origin(): AssessmentOrigin {
        if (this.clinicalSessionId || this.clinicalSessionResourceId) {
            return AssessmentOrigin.SESSION_BASED;
        }
        if (this.schemeId || this.schemeAssignmentId) {
            return AssessmentOrigin.FIXED_SCHEME;
        }
        return AssessmentOrigin.INDIVIDUAL;
    }

    @Field(() => Boolean)
    get editableFromAssessmentList(): boolean {
        return this.origin !== AssessmentOrigin.SESSION_BASED;
    }

    @BeforeInsert()
    private generateUuid() {
        this.uuid = uuidv4();
    }

    @ManyToOne(
        () => Patient,
        patient => patient.assessments,
        { nullable: true }
    )
    patient: Patient;

    @ManyToOne(() => User, user => user.targetAssessments, { nullable: true })
    targetUser: User;

    @ManyToOne(() => User, { nullable: true })
    responderUser: User;

    @ManyToOne(() => User)
    clinician: User;

    @ManyToMany(() => User)
    @JoinTable({ name: 'assessment_responsible_user' })
    responsibleUsers?: User[];

    @ManyToOne(() => User)
    informantClinician: User;

    @ManyToOne(
        () => AssessmentType,
        assessmentType => assessmentType.assessments,
    )
    assessmentType: AssessmentType;

    @ManyToOne(
        () => MailTemplate,
        mailTemplate => mailTemplate.assessments,
    )
    mailTemplate: MailTemplate

    @ManyToOne(() => CalendarOccurrence, occurrence => occurrence.assessments, { nullable: true })
    calendarOccurrence?: CalendarOccurrence;

    @ManyToOne(() => ClinicalSession, { nullable: true })
    clinicalSession?: ClinicalSession;

    @ManyToOne(() => ClinicalSessionResource, { nullable: true })
    clinicalSessionResource?: ClinicalSessionResource;

    @ManyToOne(() => TreatmentCycle, cycle => cycle.assessments, { nullable: true })
    @JoinColumn({ name: 'treatmentCycleId' })
    treatmentCycle?: TreatmentCycle;

    @ManyToOne(() => EvaluationScheme, { nullable: true })
    scheme?: EvaluationScheme;

    @ManyToOne(() => EvaluationSchemeAssignment, { nullable: true })
    schemeAssignment?: EvaluationSchemeAssignment;

    @ManyToOne(() => SchemeResourceTemplate, { nullable: true })
    schemeResourceTemplate?: SchemeResourceTemplate;

    @ManyToOne(() => ClinicalSessionSchemeApplication, { nullable: true })
    schemeApplication?: ClinicalSessionSchemeApplication;
}

@ObjectType()
export class FullAssessment extends Assessment {
    @Field(() => QuestionnaireAssessment)
    questionnaireAssessment: QuestionnaireAssessment;

    @Field(() => User)
    clinician: User;

    @Field(() => Patient, { nullable: true })
    patient: Patient;

    @Field(() => User, { nullable: true })
    targetUser: User;

    @Field(() => User, { nullable: true })
    responderUser: User;

    @Field(() => User, { nullable: true })
    informantClinician: User;

    @Field(() => AssessmentType, { nullable: true })
    assessmentType: AssessmentType;
}

@ObjectType()
export class FullPublicAssessment {
    @Field(() => Int)
    id: number;

    @Field(() => String, { nullable: true })
    uuid: string;

    @Field(() => GraphQLISODateTime, { nullable: true })
    date?: Date;

    @Field({ nullable: true })
    status: string;

    @Field(() => GraphQLISODateTime)
    createdAt: Date;

    @Field(() => GraphQLISODateTime)
    updatedAt: Date;

    @Field(() => GraphQLISODateTime, { nullable: true })
    deletedAt: Date;

    @Field(() => GraphQLISODateTime, { nullable: true })
    deliveryDate: Date;

    @Field(() => GraphQLISODateTime, { nullable: true })
    expirationDate: Date;
    
    @Field(() => String, { nullable: true })
    informantType?: string;

    @Field(() => QuestionnaireAssessment)
    questionnaireAssessment: QuestionnaireAssessment;

    @Field(() => AssessmentType, { nullable: true })
    assessmentType: AssessmentType;
}

@ObjectType()
export class AssessmentResponse extends Assessment {
    @Field(() => String)
    assessmentId: string;

     @Field(() => AssessmentType, { nullable: true })
    assessmentType: AssessmentType;
}
