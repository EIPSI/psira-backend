import { Field, GraphQLISODateTime, InputType, Int } from '@nestjs/graphql';
import { ClinicalSessionResourceKind } from '../enums/clinical-session-resource-kind.enum';
import { ClinicalSessionKind } from '../enums/clinical-session-kind.enum';
import { ResourceActivationAnchor } from 'src/modules/evaluation-scheme/enums/resource-activation-anchor.enum';
import { AssessmentInformant } from 'src/modules/assessment/enums/assessment-informant.enum';
import { ClinicalSessionStatus } from '../enums/clinical-session-status.enum';
import { ClinicalSessionResourceStatus } from '../enums/clinical-session-resource-status.enum';
import { ClinicalSessionCancellationType } from '../enums/clinical-session-cancellation-type.enum';
import { ClinicalSessionModality } from '../enums/clinical-session-modality.enum';
import {
    ClinicalSessionRepeatEndMode,
    ClinicalSessionRepeatUnit,
} from '../enums/clinical-session-repeat.enum';
import { ClinicalSessionSchemeApplicationMode } from '../enums/clinical-session-scheme-application-mode.enum';

@InputType()
export class CreateClinicalSessionResourceInput {
    @Field(() => ClinicalSessionResourceKind)
    resourceKind: ClinicalSessionResourceKind;

    @Field(() => Int, { nullable: true })
    resourceTemplateId?: number;

    schemeId?: number;

    schemeApplicationId?: number;

    schemeRelativeSessionNumber?: number;

    @Field(() => Int, { nullable: true })
    assessmentTypeId?: number;

    @Field(() => String, { nullable: true })
    name?: string;

    @Field(() => [String], { nullable: true })
    questionnaires?: string[];

    @Field(() => [String], { nullable: true })
    questionnaireBundles?: string[];

    @Field(() => [Int], { nullable: true })
    randomizationRuleIds?: number[];

    @Field(() => Int, { nullable: true })
    responderUserId?: number;

    @Field(() => Int, { nullable: true })
    clinicianId?: number;

    @Field(() => String, { nullable: true })
    informantType?: string;

    @Field(() => ResourceActivationAnchor, { nullable: true })
    activationAnchor?: ResourceActivationAnchor;

    @Field(() => Int, { nullable: true })
    activationOffsetMinutes?: number;

    @Field(() => Int, { nullable: true })
    availabilityDurationMinutes?: number;

    @Field(() => [Int], { nullable: true })
    reminderMinutes?: number[];

    @Field(() => String, { nullable: true })
    note?: string;

    @Field(() => Boolean, { nullable: true })
    emailReminder?: boolean;

    @Field(() => String, { nullable: true })
    receiverEmail?: string;

    @Field(() => Int, { nullable: true })
    mailTemplateId?: number;
}

@InputType()
export class CreateClinicalSessionInput {
    @Field()
    title: string;

    @Field(() => ClinicalSessionKind)
    sessionKind: ClinicalSessionKind;

    @Field(() => GraphQLISODateTime)
    startAt: Date;

    @Field(() => GraphQLISODateTime)
    endAt: Date;

    @Field({ nullable: true })
    timezone?: string;

    @Field(() => Int, { nullable: true })
    schemeId?: number;

    @Field(() => [Int], { nullable: true })
    schemeIds?: number[];

    @Field(() => Int, { nullable: true })
    schemeAssignmentId?: number;

    @Field(() => Int, { nullable: true })
    sessionTemplateId?: number;

    @Field(() => Int, { nullable: true })
    sessionNumber?: number;

    @Field(() => Int, { nullable: true })
    treatmentCycleId?: number;

    @Field(() => Int, { nullable: true })
    patientId?: number;

    @Field(() => Int, { nullable: true })
    targetUserId?: number;

    @Field(() => Int, { nullable: true })
    therapistId?: number;

    @Field(() => Int, { nullable: true })
    supervisorId?: number;

    @Field(() => [Int], { nullable: true })
    responsibleUserIds?: number[];

    @Field(() => ClinicalSessionModality, { nullable: true })
    modality?: ClinicalSessionModality;

    @Field(() => [CreateClinicalSessionResourceInput], { nullable: true })
    resources?: CreateClinicalSessionResourceInput[];
}

@InputType()
export class MoveClinicalSessionInput {
    @Field(() => Int)
    clinicalSessionId: number;

    @Field(() => GraphQLISODateTime)
    startAt: Date;

    @Field(() => GraphQLISODateTime)
    endAt: Date;
}

@InputType()
export class UpdateClinicalSessionInput {
    @Field(() => Int)
    clinicalSessionId: number;

    @Field(() => Int, { nullable: true })
    sessionNumber?: number;

    @Field(() => GraphQLISODateTime, { nullable: true })
    startAt?: Date;

    @Field(() => GraphQLISODateTime, { nullable: true })
    endAt?: Date;

    @Field(() => String, { nullable: true })
    clinicalHistory?: string;

    @Field(() => [Int], { nullable: true })
    responsibleUserIds?: number[];

    @Field(() => ClinicalSessionModality, { nullable: true })
    modality?: ClinicalSessionModality;
}

@InputType()
export class UpdateClinicalSessionFollowUpSettingsInput {
    @Field(() => Int)
    editWindowDays: number;
}

@InputType()
export class RestructureClinicalSessionsInput {
    @Field(() => Int)
    clinicalSessionId: number;

    @Field(() => GraphQLISODateTime)
    startAt: Date;

    @Field(() => GraphQLISODateTime)
    endAt: Date;

    @Field(() => Int)
    every: number;

    @Field(() => ClinicalSessionRepeatUnit)
    unit: ClinicalSessionRepeatUnit;

    @Field(() => [Int], { nullable: true })
    repeatOnDays?: number[];

    @Field(() => ClinicalSessionRepeatEndMode)
    endMode: ClinicalSessionRepeatEndMode;

    @Field(() => GraphQLISODateTime, { nullable: true })
    endDate?: Date;

    @Field(() => Int, { nullable: true })
    count?: number;
}

@InputType()
export class UpdateClinicalSessionResourceInput {
    @Field(() => Int)
    resourceId: number;

    @Field(() => ClinicalSessionResourceKind, { nullable: true })
    resourceKind?: ClinicalSessionResourceKind;

    @Field(() => ClinicalSessionResourceStatus, { nullable: true })
    status?: ClinicalSessionResourceStatus;

    @Field(() => ResourceActivationAnchor, { nullable: true })
    activationAnchor?: ResourceActivationAnchor;

    @Field(() => Int, { nullable: true })
    activationOffsetMinutes?: number;

    @Field(() => Int, { nullable: true })
    availabilityDurationMinutes?: number;

    @Field(() => [Int], { nullable: true })
    reminderMinutes?: number[];

    @Field(() => GraphQLISODateTime, { nullable: true })
    activationAt?: Date;

    @Field(() => GraphQLISODateTime, { nullable: true })
    expirationAt?: Date;
}

@InputType()
export class AddClinicalSessionSchemesInput {
    @Field(() => Int)
    clinicalSessionId: number;

    @Field(() => [Int])
    schemeIds: number[];

    @Field(() => Boolean, { nullable: true })
    propagateFuture?: boolean;

    @Field(() => ClinicalSessionSchemeApplicationMode, { nullable: true })
    applicationMode?: ClinicalSessionSchemeApplicationMode;

    @Field(() => Boolean, { nullable: true })
    overwriteExisting?: boolean;
}

@InputType()
export class DiscardClinicalSessionAssessmentInput {
    @Field(() => Int)
    assessmentId: number;
}

@InputType()
export class StopClinicalSessionSchemeInput {
    @Field(() => Int)
    clinicalSessionId: number;

    @Field(() => Int)
    schemeId: number;
}

@InputType()
export class ClinicalSessionListFilterInput {
    @Field(() => Int, { nullable: true })
    patientId?: number;

    @Field(() => Int, { nullable: true })
    therapistId?: number;

    @Field(() => Int, { nullable: true })
    supervisorId?: number;

    @Field(() => ClinicalSessionKind, { nullable: true })
    sessionKind?: ClinicalSessionKind;

    @Field(() => ClinicalSessionStatus, { nullable: true })
    clinicalStatus?: ClinicalSessionStatus;

    @Field(() => Boolean, { nullable: true })
    includeCancelled?: boolean;
}

@InputType()
export class CancelClinicalSessionInput {
    @Field(() => Int)
    clinicalSessionId: number;

    @Field(() => ClinicalSessionCancellationType, { nullable: true })
    cancellationType?: ClinicalSessionCancellationType;

    @Field(() => Int, { nullable: true })
    cancellationReasonId?: number;

    @Field(() => Boolean, { nullable: true })
    renumberFutureSessions?: boolean;

    @Field(() => String, { nullable: true })
    cancellationReason?: string;

    @Field(() => String, { nullable: true })
    cancellationOtherReason?: string;

    @Field(() => String, { nullable: true })
    cancellationComment?: string;

    @Field(() => [Int], { nullable: true })
    excludedAutomationIds?: number[];
}

export const defaultInformantType = AssessmentInformant.PATIENT;
