import { registerEnumType } from '@nestjs/graphql';

export enum EvaluationAutomationConditionOperator {
    EQ = 'EQ',
    NEQ = 'NEQ',
    GT = 'GT',
    GTE = 'GTE',
    LT = 'LT',
    LTE = 'LTE',
    CONTAINS = 'CONTAINS',
    NOT_CONTAINS = 'NOT_CONTAINS',
    IN = 'IN',
    NOT_IN = 'NOT_IN',
    IS_EMPTY = 'IS_EMPTY',
    IS_NOT_EMPTY = 'IS_NOT_EMPTY',
    BOOLEAN = 'BOOLEAN',
}

registerEnumType(EvaluationAutomationConditionOperator, {
    name: 'EvaluationAutomationConditionOperator',
});
