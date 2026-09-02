import { registerEnumType } from '@nestjs/graphql';

export enum InformedConsentResponseStatus {
    PENDING = 'PENDING',
    SUBMITTED = 'SUBMITTED',
    BLOCKED = 'BLOCKED',
    REACTIVATED = 'REACTIVATED',
    REVOKED = 'REVOKED',
}

registerEnumType(InformedConsentResponseStatus, { name: 'InformedConsentResponseStatus' });
