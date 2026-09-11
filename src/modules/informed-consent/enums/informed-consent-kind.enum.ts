import { registerEnumType } from '@nestjs/graphql';

export enum InformedConsentKind {
    TERMS_OF_USE = 'TERMS_OF_USE',
    TREATMENT = 'TREATMENT',
    RESEARCH = 'RESEARCH',
}

registerEnumType(InformedConsentKind, { name: 'InformedConsentKind' });
