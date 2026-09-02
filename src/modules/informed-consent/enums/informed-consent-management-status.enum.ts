import { registerEnumType } from '@nestjs/graphql';

export enum InformedConsentManagementStatus {
    DRAFT = 'DRAFT',
    ACTIVE = 'ACTIVE',
    PAUSED = 'PAUSED',
    ARCHIVED = 'ARCHIVED',
}

registerEnumType(InformedConsentManagementStatus, { name: 'InformedConsentManagementStatus' });
