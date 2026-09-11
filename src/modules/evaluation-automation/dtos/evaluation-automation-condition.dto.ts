import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { EvaluationAutomationConditionOperator } from '../enums/evaluation-automation-condition-operator.enum';

@InputType('EvaluationAutomationConditionInput')
@ObjectType('EvaluationAutomationCondition')
export class EvaluationAutomationConditionDto {
    @Field()
    field: string;

    @Field(() => EvaluationAutomationConditionOperator)
    operator: EvaluationAutomationConditionOperator;

    @Field({ nullable: true })
    value?: string;
}
