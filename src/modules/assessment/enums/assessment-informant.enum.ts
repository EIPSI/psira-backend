import { registerEnumType } from '@nestjs/graphql';

export enum AssessmentInformant {
    PATIENT = 'PATIENT',
    USER = 'USER',
    CAREGIVER = 'CAREGIVER',
    CASE_MANAGER = 'CASE_MANAGER',
    OTHER_USER = 'OTHER_USER',
}

registerEnumType(AssessmentInformant, { name: 'AssessmentInformant' });
