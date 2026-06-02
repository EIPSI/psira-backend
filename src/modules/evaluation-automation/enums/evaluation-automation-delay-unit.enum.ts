import { registerEnumType } from '@nestjs/graphql';

export enum EvaluationAutomationDelayUnit {
    DAYS = 'DAYS',
    MINUTES = 'MINUTES',
}

registerEnumType(EvaluationAutomationDelayUnit, {
    name: 'EvaluationAutomationDelayUnit',
});
