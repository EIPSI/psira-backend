import { registerEnumType } from '@nestjs/graphql';

export enum ClinicalSessionCancellationLabel {
    RESCHEDULED = 'REPROGRAMADA',
    CANCELLED = 'CANCELADA',
}

registerEnumType(ClinicalSessionCancellationLabel, {
    name: 'ClinicalSessionCancellationLabel',
});
