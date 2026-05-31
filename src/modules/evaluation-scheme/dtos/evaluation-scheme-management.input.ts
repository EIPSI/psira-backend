import { Field, InputType, Int } from '@nestjs/graphql';
import { AssessmentInformant } from 'src/modules/assessment/enums/assessment-informant.enum';
import { ClinicalSessionKind } from 'src/modules/clinical-session/enums/clinical-session-kind.enum';
import { ClinicalSessionResourceKind } from 'src/modules/clinical-session/enums/clinical-session-resource-kind.enum';
import { ResourceActivationAnchor } from '../enums/resource-activation-anchor.enum';
import { EvaluationSchemeType } from '../enums/evaluation-scheme-type.enum';

@InputType()
export class SchemeResourceTemplateInput {
    @Field(() => ClinicalSessionResourceKind)
    resourceKind: ClinicalSessionResourceKind;

    @Field(() => Int, { nullable: true })
    assessmentTypeId?: number;

    @Field(() => [String], { nullable: true })
    questionnaireIds?: string[];

    @Field(() => [String], { nullable: true })
    questionnaireBundleIds?: string[];

    @Field(() => String, { nullable: true })
    sessionSelector?: string;

    @Field(() => Int, { nullable: true })
    everyNSessions?: number;

    @Field(() => Int, { nullable: true })
    startSessionNumber?: number;

    @Field(() => Int, { nullable: true })
    endSessionNumber?: number;

    @Field(() => String, { nullable: true })
    informantType?: string;

    @Field(() => String, { nullable: true })
    defaultResponderRole?: string;

    @Field(() => ResourceActivationAnchor, { nullable: true })
    activationAnchor?: ResourceActivationAnchor;

    @Field(() => Int, { nullable: true })
    activationOffsetMinutes?: number;

    @Field(() => Int, { nullable: true })
    availabilityDurationMinutes?: number;

    @Field(() => [Int], { nullable: true })
    reminderMinutes?: number[];
}

@InputType()
export class SchemeSessionTemplateInput {
    @Field(() => Int, { nullable: true })
    schemeId?: number;

    @Field(() => ClinicalSessionKind)
    sessionKind: ClinicalSessionKind;

    @Field(() => Int)
    sessionIndex: number;

    @Field()
    title: string;

    @Field(() => Int, { nullable: true })
    relativeOffsetDays?: number;

    @Field(() => Int, { nullable: true })
    durationMinutes?: number;

    @Field(() => [SchemeResourceTemplateInput], { nullable: true })
    resourceTemplates?: SchemeResourceTemplateInput[];
}

@InputType()
export class AddSchemeResourceTemplateInput extends SchemeResourceTemplateInput {
    @Field(() => Int)
    sessionTemplateId: number;
}

@InputType()
export class UpdateSchemeResourceTemplateInput extends SchemeResourceTemplateInput {
    @Field(() => Int)
    id: number;
}

@InputType()
export class IndependentEvaluationTemplateInput {
    @Field(() => Int, { nullable: true })
    schemeId?: number;

    @Field(() => Int)
    assessmentTypeId: number;

    @Field(() => [String], { nullable: true })
    questionnaireIds?: string[];

    @Field(() => [String], { nullable: true })
    questionnaireBundleIds?: string[];

    @Field(() => Int, { nullable: true })
    relativeDay?: number;

    @Field(() => Int, { nullable: true })
    relativeMinuteOfDay?: number;

    @Field(() => Int, { nullable: true })
    startMinuteOfDay?: number;

    @Field(() => Int, { nullable: true })
    durationMinutes?: number;

    @Field(() => Int, { nullable: true })
    endMinuteOfDay?: number;

    @Field(() => String, { nullable: true })
    triggerMode?: string;

    @Field(() => Int, { nullable: true })
    availabilityDurationMinutes?: number;

    @Field(() => [Int], { nullable: true })
    reminderMinutes?: number[];

    @Field(() => Boolean, { nullable: true })
    required?: boolean;

    @Field(() => Boolean, { nullable: true })
    singleResponse?: boolean;

    @Field(() => Int, { nullable: true })
    seedOrder?: number;

    @Field(() => String, { nullable: true })
    informantType?: string;

    @Field(() => String, { nullable: true })
    defaultResponderRole?: string;
}

@InputType()
export class UpdateIndependentEvaluationTemplateInput extends IndependentEvaluationTemplateInput {
    @Field(() => Int)
    id: number;
}

@InputType()
export class CreateEvaluationSchemeInput {
    @Field()
    name: string;

    @Field(() => String, { nullable: true })
    description?: string;

    @Field(() => EvaluationSchemeType)
    schemeType: EvaluationSchemeType;

    @Field(() => String, { nullable: true })
    defaultRecurrenceRule?: string;

    @Field(() => Int, { nullable: true })
    defaultDurationMinutes?: number;

    @Field(() => Int, { nullable: true })
    durationDays?: number;

    @Field(() => Boolean, { nullable: true })
    active?: boolean;

    @Field(() => Boolean, { nullable: true })
    emailNotificationsEnabled?: boolean;

    @Field(() => Int, { nullable: true })
    mailTemplateId?: number;

    @Field(() => [Int], { nullable: true })
    departmentIds?: number[];

    @Field(() => [SchemeSessionTemplateInput], { nullable: true })
    sessionTemplates?: SchemeSessionTemplateInput[];

    @Field(() => [IndependentEvaluationTemplateInput], { nullable: true })
    independentEvaluationTemplates?: IndependentEvaluationTemplateInput[];
}

@InputType()
export class UpdateEvaluationSchemeInput {
    @Field(() => Int)
    id: number;

    @Field(() => String, { nullable: true })
    name?: string;

    @Field(() => String, { nullable: true })
    description?: string;

    @Field(() => String, { nullable: true })
    defaultRecurrenceRule?: string;

    @Field(() => Int, { nullable: true })
    defaultDurationMinutes?: number;

    @Field(() => Int, { nullable: true })
    durationDays?: number;

    @Field(() => Boolean, { nullable: true })
    active?: boolean;

    @Field(() => Boolean, { nullable: true })
    emailNotificationsEnabled?: boolean;

    @Field(() => Int, { nullable: true })
    mailTemplateId?: number;

    @Field(() => [Int], { nullable: true })
    departmentIds?: number[];
}

export const defaultSchemeInformantType = AssessmentInformant.PATIENT;
