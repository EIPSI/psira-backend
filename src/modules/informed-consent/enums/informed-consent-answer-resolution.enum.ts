import { registerEnumType } from '@nestjs/graphql';

export enum InformedConsentAnswerResolution {
    ACCEPTS = 'ACCEPTS',
    REJECTS = 'REJECTS',
    REQUIRES_REVIEW = 'REQUIRES_REVIEW',
    NOT_APPLICABLE = 'NOT_APPLICABLE',
}

registerEnumType(InformedConsentAnswerResolution, { name: 'InformedConsentAnswerResolution' });
