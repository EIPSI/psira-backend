import { registerEnumType } from '@nestjs/graphql';

export enum EvaluationAutomationDelayUnit {
    DAYS = 'DAYS',
    MINUTES = 'MINUTES',
    HOURS = 'HOURS',
    WEEKS = 'WEEKS',
    MONTHS = 'MONTHS',
    YEARS = 'YEARS',
}

registerEnumType(EvaluationAutomationDelayUnit, {
    name: 'EvaluationAutomationDelayUnit',
});
