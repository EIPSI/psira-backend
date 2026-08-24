import { registerEnumType } from '@nestjs/graphql';

export enum TreatmentCycleStatus {
    ACTIVE = 'ACTIVE',
    FINALIZED = 'FINALIZED',
    FINALIZATION_CANCELLED = 'FINALIZATION_CANCELLED',
}

registerEnumType(TreatmentCycleStatus, {
    name: 'TreatmentCycleStatus',
});
