import { Field, InputType, Int } from '@nestjs/graphql';
import { IsArray, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { CaseEventReasonContext } from 'src/modules/treatment-cycle/enums/case-event-reason-context.enum';
import { EvaluationAutomationTriggerPoint } from '../enums/evaluation-automation-trigger-point.enum';

@InputType()
export class EvaluationAutomationPreviewInput {
    @Field(() => [Int], { nullable: true })
    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    roleIds?: number[];

    @Field(() => [String], { nullable: true })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    roleCodes?: string[];

    @Field(() => [Int], { nullable: true })
    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    departmentIds?: number[];

    @Field(() => EvaluationAutomationTriggerPoint, { nullable: true })
    @IsOptional()
    @IsEnum(EvaluationAutomationTriggerPoint)
    triggerPoint?: EvaluationAutomationTriggerPoint;

    @Field(() => [Int], { nullable: true })
    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    reasonIds?: number[];

    @Field(() => [CaseEventReasonContext], { nullable: true })
    @IsOptional()
    @IsArray()
    @IsEnum(CaseEventReasonContext, { each: true })
    reasonContexts?: CaseEventReasonContext[];
}
