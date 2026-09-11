import { registerEnumType } from '@nestjs/graphql';

export enum InformedConsentVersionStatus {
    DRAFT = 'DRAFT',
    PUBLISHED = 'PUBLISHED',
    ARCHIVED = 'ARCHIVED',
}

registerEnumType(InformedConsentVersionStatus, { name: 'InformedConsentVersionStatus' });
