import { registerEnumType } from '@nestjs/graphql';

export enum ClinicalSessionResourceStatus {
    PENDING = 'PENDING',
    OPEN = 'OPEN',
    COMPLETED = 'COMPLETED',
    DETACHED = 'DETACHED',
    CANCELLED = 'CANCELLED',
}

registerEnumType(ClinicalSessionResourceStatus, {
    name: 'ClinicalSessionResourceStatus',
});
