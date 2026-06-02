import { registerEnumType } from '@nestjs/graphql';

export enum EvaluationAutomationRunStatus {
    PENDING = 'pending',
    EXECUTED = 'executed',
    FAILED = 'failed',
    SKIPPED = 'skipped',
    CANCELLED = 'cancelled',
}

registerEnumType(EvaluationAutomationRunStatus, {
    name: 'EvaluationAutomationRunStatus',
});
