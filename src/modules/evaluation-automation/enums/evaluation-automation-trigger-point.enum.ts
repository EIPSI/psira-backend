import { registerEnumType } from '@nestjs/graphql';

export enum EvaluationAutomationTriggerPoint {
    USER_CREATED = 'user_created',
    FIRST_LOGIN = 'first_login',
}

registerEnumType(EvaluationAutomationTriggerPoint, {
    name: 'EvaluationAutomationTriggerPoint',
});
