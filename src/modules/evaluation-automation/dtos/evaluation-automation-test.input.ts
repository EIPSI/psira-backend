import { Field, GraphQLISODateTime, InputType, Int } from '@nestjs/graphql';
import { IsArray, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { CaseEventReasonContext } from 'src/modules/treatment-cycle/enums/case-event-reason-context.enum';
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

    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    patientId?: number;

    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    therapistId?: number;

    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    treatmentCycleId?: number;

    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    clinicalSessionId?: number;

    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    sessionNumber?: number;

    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    reasonId?: number;

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

    @Field(() => GraphQLISODateTime, { nullable: true })
    @IsOptional()
    triggerOccurredAt?: Date;

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    triggerEventId?: string;
}
