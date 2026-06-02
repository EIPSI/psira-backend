import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import { EvaluationAutomationResourceType } from '../enums/evaluation-automation-resource-type.enum';
import { EvaluationAutomationTriggerPoint } from '../enums/evaluation-automation-trigger-point.enum';
import { EvaluationAutomationType } from '../enums/evaluation-automation-type.enum';

@ObjectType()
export class EvaluationAutomationPreviewResultDto {
    @Field(() => Int)
    automationId: number;

    @Field()
    title: string;

    @Field(() => EvaluationAutomationTriggerPoint)
    triggerPoint: EvaluationAutomationTriggerPoint;

    @Field(() => EvaluationAutomationType)
    automationType: EvaluationAutomationType;

    @Field(() => EvaluationAutomationResourceType)
    resourceType: EvaluationAutomationResourceType;

    @Field({ nullable: true })
    resourceName?: string;

    @Field(() => GraphQLISODateTime)
    scheduledAt: Date;

    @Field()
    delayLabel: string;
}
