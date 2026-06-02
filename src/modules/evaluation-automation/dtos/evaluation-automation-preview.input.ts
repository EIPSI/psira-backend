import { Field, InputType, Int } from '@nestjs/graphql';
import { IsArray, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
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
}
