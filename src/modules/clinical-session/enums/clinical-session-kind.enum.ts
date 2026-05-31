import { registerEnumType } from '@nestjs/graphql';

export enum ClinicalSessionKind {
    CLINICAL = 'CLINICAL',
    SUPERVISION = 'SUPERVISION',
}

registerEnumType(ClinicalSessionKind, {
    name: 'ClinicalSessionKind',
});
