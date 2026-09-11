import { registerEnumType } from '@nestjs/graphql';

export enum ClinicalSessionCancellationType {
    RESCHEDULED = 'RESCHEDULED',
    NO_SHOW = 'NO_SHOW',
}

registerEnumType(ClinicalSessionCancellationType, {
    name: 'ClinicalSessionCancellationType',
});
