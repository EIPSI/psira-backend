import { registerEnumType } from '@nestjs/graphql';

export enum InformedConsentTrigger {
    USER_CREATED = 'USER_CREATED',
    FIRST_LOGIN = 'FIRST_LOGIN',
    NEW_TREATMENT = 'NEW_TREATMENT',
    CONSENT_VERSION_CHANGED = 'CONSENT_VERSION_CHANGED',
}

registerEnumType(InformedConsentTrigger, { name: 'InformedConsentTrigger' });
