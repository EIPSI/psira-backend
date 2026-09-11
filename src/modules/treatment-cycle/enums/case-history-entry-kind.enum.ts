import { registerEnumType } from '@nestjs/graphql';

export enum CaseHistoryEntryKind {
    NOTE = 'NOTE',
    TREATMENT_FINALIZATION = 'TREATMENT_FINALIZATION',
    FINALIZATION_CANCELLED = 'FINALIZATION_CANCELLED',
    NEW_TREATMENT = 'NEW_TREATMENT',
}

registerEnumType(CaseHistoryEntryKind, {
    name: 'CaseHistoryEntryKind',
});
