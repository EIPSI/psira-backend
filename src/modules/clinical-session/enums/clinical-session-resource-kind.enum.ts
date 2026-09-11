import { registerEnumType } from '@nestjs/graphql';

export enum ClinicalSessionResourceKind {
    PRE_ASSESSMENT = 'PRE_ASSESSMENT',
    POST_ASSESSMENT = 'POST_ASSESSMENT',
    CLINICAL_NOTES = 'CLINICAL_NOTES',
    FOLLOW_UP = 'FOLLOW_UP',
}

registerEnumType(ClinicalSessionResourceKind, {
    name: 'ClinicalSessionResourceKind',
});
