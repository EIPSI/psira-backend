import { registerEnumType } from '@nestjs/graphql';

export enum InformedConsentQuestionType {
    CHECKBOX = 'CHECKBOX',
    SINGLE_CHOICE = 'SINGLE_CHOICE',
    MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
    SHORT_TEXT = 'SHORT_TEXT',
    LONG_TEXT = 'LONG_TEXT',
    DATE = 'DATE',
}

registerEnumType(InformedConsentQuestionType, { name: 'InformedConsentQuestionType' });
