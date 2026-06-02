import { Field, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { EvaluationAutomationTriggerPoint } from '../enums/evaluation-automation-trigger-point.enum';

@InputType()
export class TestEvaluationAutomationInput {
    @Field(() => Int)
    @IsInt()
    automationId: number;

    @Field(() => Int)
    @IsInt()
    userId: number;

    @Field(() => EvaluationAutomationTriggerPoint)
    @IsEnum(EvaluationAutomationTriggerPoint)
    triggerPoint: EvaluationAutomationTriggerPoint;

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    triggerEventId?: string;
}
