import { registerEnumType } from '@nestjs/graphql';

export enum ClinicalSessionStatus {
    SCHEDULED = 'SCHEDULED',
    OPEN = 'OPEN',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
}

registerEnumType(ClinicalSessionStatus, {
    name: 'ClinicalSessionStatus',
});
