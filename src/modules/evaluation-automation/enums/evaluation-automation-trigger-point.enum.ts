import { registerEnumType } from '@nestjs/graphql';

export enum EvaluationAutomationTriggerPoint {
    USER_CREATED = 'user_created',
    FIRST_LOGIN = 'first_login',
    LAST_LOGIN = 'last_login',
    SESSION_NUMBER = 'session_number',
    TREATMENT_FINALIZATION = 'treatment_finalization',
    SESSION_NO_SHOW_CANCELLATION = 'session_no_show_cancellation',
    NEW_TREATMENT = 'new_treatment',
}

registerEnumType(EvaluationAutomationTriggerPoint, {
    name: 'EvaluationAutomationTriggerPoint',
});
