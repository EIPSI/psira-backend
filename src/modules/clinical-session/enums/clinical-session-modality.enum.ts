import { registerEnumType } from '@nestjs/graphql';

export enum ClinicalSessionModality {
    IN_PERSON = 'IN_PERSON',
    ONLINE = 'ONLINE',
}

registerEnumType(ClinicalSessionModality, {
    name: 'ClinicalSessionModality',
});
