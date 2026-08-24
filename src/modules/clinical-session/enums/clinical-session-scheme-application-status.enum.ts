import { registerEnumType } from '@nestjs/graphql';

export enum ClinicalSessionSchemeApplicationStatus {
    ACTIVE = 'ACTIVE',
    STOPPED = 'STOPPED',
    REPLACED = 'REPLACED',
}

registerEnumType(ClinicalSessionSchemeApplicationStatus, {
    name: 'ClinicalSessionSchemeApplicationStatus',
});
