import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import { EvaluationAutomationConditionDto } from './evaluation-automation-condition.dto';
import { EvaluationAutomationResourceType } from '../enums/evaluation-automation-resource-type.enum';

function stringifyActualValue(value: any): string {
    if (value === undefined || value === null) return null;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

@ObjectType()
export class EvaluationAutomationConditionResultDto {
    @Field(() => EvaluationAutomationConditionDto)
    condition: EvaluationAutomationConditionDto;

    @Field()
    passed: boolean;

    @Field({ nullable: true })
    actualValue?: string;
}

@ObjectType()
export class EvaluationAutomationTestResultDto {
    static fromResult(result: EvaluationAutomationTestResultDto): EvaluationAutomationTestResultDto {
        return {
            ...result,
            conditionResults: (result.conditionResults || []).map(conditionResult => ({
                ...conditionResult,
                actualValue: stringifyActualValue(conditionResult.actualValue),
            })),
        };
    }

    @Field(() => Int)
    automationId: number;

    @Field()
    applies: boolean;

    @Field()
    duplicateDetected: boolean;

    @Field(() => EvaluationAutomationResourceType, { nullable: true })
    resourceType?: EvaluationAutomationResourceType;

    @Field(() => GraphQLISODateTime, { nullable: true })
    scheduledAt?: Date;

    @Field(() => [String])
    unmetReasons: string[];

    @Field(() => [EvaluationAutomationConditionResultDto])
    conditionResults: EvaluationAutomationConditionResultDto[];
}
