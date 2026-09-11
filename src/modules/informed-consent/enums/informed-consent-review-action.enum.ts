import { registerEnumType } from '@nestjs/graphql';

export enum InformedConsentReviewAction {
    REACTIVATE = 'REACTIVATE',
    CANCEL_REACTIVATION = 'CANCEL_REACTIVATION',
    REJECT = 'REJECT',
    REVOKE = 'REVOKE',
}

registerEnumType(InformedConsentReviewAction, { name: 'InformedConsentReviewAction' });
