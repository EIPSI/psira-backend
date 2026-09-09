import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import { AssessmentOrigin } from 'src/modules/assessment/enums/assessment-origin.enum';
import { ClinicalSessionCancellationLabel } from 'src/modules/clinical-session/enums/clinical-session-cancellation-label.enum';
import { ClinicalSessionCancellationType } from 'src/modules/clinical-session/enums/clinical-session-cancellation-type.enum';
import { ClinicalSessionKind } from 'src/modules/clinical-session/enums/clinical-session-kind.enum';
import { ClinicalSessionModality } from 'src/modules/clinical-session/enums/clinical-session-modality.enum';
import { Department } from 'src/modules/department/models/department.model';
import { Patient } from 'src/modules/patient/models/patient.model';
import { User } from 'src/modules/user/models/user.model';
import { CalendarOccurrenceStatus } from '../enums/calendar-occurrence-status.enum';
import { CalendarOccurrenceType } from '../enums/calendar-occurrence-type.enum';
import { CalendarEventType } from '../enums/calendar-event-type.enum';

@ObjectType()
export class CalendarEvent {
    @Field()
    id: string;

    @Field(() => CalendarEventType)
    type: CalendarEventType;

    @Field()
    title: string;

    @Field({ nullable: true })
    description?: string;

    @Field(() => GraphQLISODateTime)
    startAt: Date;

    @Field(() => GraphQLISODateTime)
    endAt: Date;

    @Field(() => CalendarOccurrenceStatus, { nullable: true })
    status?: CalendarOccurrenceStatus;

    @Field({ nullable: true })
    color?: string;

    @Field(() => Boolean)
    editable: boolean;

    @Field(() => Boolean)
    deletable: boolean;

    @Field(() => Int, { nullable: true })
    occurrenceId?: number;

    @Field(() => CalendarOccurrenceType, { nullable: true })
    occurrenceType?: CalendarOccurrenceType;

    @Field(() => Int, { nullable: true })
    patientId?: number;

    @Field(() => Int, { nullable: true })
    therapistId?: number;

    @Field(() => Int, { nullable: true })
    supervisorId?: number;

    @Field(() => [Int], { nullable: true })
    responsibleUserIds?: number[];

    @Field(() => Int, { nullable: true })
    clinicalSessionId?: number;

    @Field(() => ClinicalSessionKind, { nullable: true })
    sessionKind?: ClinicalSessionKind;

    @Field(() => Int, { nullable: true })
    sessionNumber?: number;

    @Field(() => ClinicalSessionModality, { nullable: true })
    modality?: ClinicalSessionModality;

    @Field(() => ClinicalSessionCancellationType, { nullable: true })
    cancellationType?: ClinicalSessionCancellationType;

    @Field(() => ClinicalSessionCancellationLabel, { nullable: true })
    cancellationLabel?: ClinicalSessionCancellationLabel;

    @Field({ nullable: true })
    cancellationReasonSnapshot?: string;

    @Field({ nullable: true })
    cancellationComment?: string;

    @Field(() => Int, { nullable: true })
    assessmentId?: number;

    @Field(() => Int, { nullable: true })
    clinicalSessionResourceId?: number;

    @Field(() => AssessmentOrigin, { nullable: true })
    assessmentOrigin?: AssessmentOrigin;

    @Field(() => Patient, { nullable: true })
    patient?: Patient;

    @Field(() => User, { nullable: true })
    therapist?: User;

    @Field(() => User, { nullable: true })
    supervisor?: User;

    @Field(() => User, { nullable: true })
    targetUser?: User;

    @Field(() => User, { nullable: true })
    responderUser?: User;

    @Field(() => [Department], { nullable: true })
    departments?: Department[];
}
