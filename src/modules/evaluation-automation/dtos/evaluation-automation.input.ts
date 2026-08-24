import { Field, InputType, Int, PartialType } from '@nestjs/graphql';
import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EvaluationAutomationConditionDto } from './evaluation-automation-condition.dto';
import { EvaluationAutomationDelayUnit } from '../enums/evaluation-automation-delay-unit.enum';
import { EvaluationAutomationTriggerPoint } from '../enums/evaluation-automation-trigger-point.enum';
import { EvaluationAutomationType } from '../enums/evaluation-automation-type.enum';
import { CaseEventReasonContext } from 'src/modules/treatment-cycle/enums/case-event-reason-context.enum';

@InputType()
export class CreateEvaluationAutomationInput {
    @Field()
    @IsString()
    title: string;

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    description?: string;

    @Field({ nullable: true, defaultValue: true })
    @IsOptional()
    @IsBoolean()
    active?: boolean;

    @Field(() => [Int])
    @IsArray()
    @IsInt({ each: true })
    departmentIds: number[];

    @Field(() => Int)
    @IsInt()
    roleId: number;

    @Field(() => [EvaluationAutomationConditionDto], { nullable: true })
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => EvaluationAutomationConditionDto)
    conditions?: EvaluationAutomationConditionDto[];

    @Field(() => EvaluationAutomationTriggerPoint)
    @IsEnum(EvaluationAutomationTriggerPoint)
    triggerPoint: EvaluationAutomationTriggerPoint;

    @Field(() => EvaluationAutomationType)
    @IsEnum(EvaluationAutomationType)
    automationType: EvaluationAutomationType;

    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    triggerSessionNumber?: number;

    @Field(() => [Int], { nullable: true })
    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    triggerReasonIds?: number[];

    @Field(() => [CaseEventReasonContext], { nullable: true })
    @IsOptional()
    @IsArray()
    @IsEnum(CaseEventReasonContext, { each: true })
    triggerReasonContexts?: CaseEventReasonContext[];

    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    lastLoginInactiveDays?: number;

    @Field(() => Int)
    @IsInt()
    @Min(0)
    delayAmount: number;

    @Field(() => EvaluationAutomationDelayUnit)
    @IsEnum(EvaluationAutomationDelayUnit)
    delayUnit: EvaluationAutomationDelayUnit;

    @Field(() => Int, { nullable: true, defaultValue: 100 })
    @IsOptional()
    @IsInt()
    @Min(1)
    priority?: number;

    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    schemeId?: number;

    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    assessmentTypeId?: number;

    @Field(() => [String], { nullable: true })
    @IsOptional()
    @IsArray()
    questionnaireIds?: string[];

    @Field(() => [String], { nullable: true })
    @IsOptional()
    @IsArray()
    questionnaireBundleIds?: string[];

    @Field(() => [Int], { nullable: true })
    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    randomizationRuleIds?: number[];

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    evaluationName?: string;

    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    expirationMinutes?: number;

    @Field(() => [Int], { nullable: true })
    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    reminderMinutes?: number[];

    @Field({ nullable: true, defaultValue: true })
    @IsOptional()
    @IsBoolean()
    emailNotificationsEnabled?: boolean;

    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    mailTemplateId?: number;
}

@InputType()
export class UpdateEvaluationAutomationInput extends PartialType(
    CreateEvaluationAutomationInput,
) {
    @Field(() => Int)
    @IsInt()
    id: number;
}
