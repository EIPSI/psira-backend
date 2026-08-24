import { registerEnumType } from '@nestjs/graphql';

export enum TreatmentCycleKind {
    CLINICAL = 'CLINICAL',
    SUPERVISION = 'SUPERVISION',
}

registerEnumType(TreatmentCycleKind, {
    name: 'TreatmentCycleKind',
});
