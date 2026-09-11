import { registerEnumType } from '@nestjs/graphql';

export enum EvaluationSchemeAssignmentStatus {
    ACTIVE = 'ACTIVE',
    PAUSED = 'PAUSED',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
}

registerEnumType(EvaluationSchemeAssignmentStatus, {
    name: 'EvaluationSchemeAssignmentStatus',
});
