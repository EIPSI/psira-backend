import { registerEnumType } from '@nestjs/graphql';

export enum ClinicalSessionSchemeApplicationMode {
    RELATIVE_FROM_SESSION = 'RELATIVE_FROM_SESSION',
    ORIGINAL_SESSION_NUMBER = 'ORIGINAL_SESSION_NUMBER',
}

registerEnumType(ClinicalSessionSchemeApplicationMode, {
    name: 'ClinicalSessionSchemeApplicationMode',
});
