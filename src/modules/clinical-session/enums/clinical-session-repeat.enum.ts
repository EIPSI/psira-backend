import { registerEnumType } from '@nestjs/graphql';

export enum ClinicalSessionRepeatUnit {
    DAY = 'DAY',
    WEEK = 'WEEK',
    MONTH = 'MONTH',
    YEAR = 'YEAR',
}

export enum ClinicalSessionRepeatEndMode {
    NEVER = 'NEVER',
    ON_DATE = 'ON_DATE',
    AFTER_COUNT = 'AFTER_COUNT',
}

registerEnumType(ClinicalSessionRepeatUnit, {
    name: 'ClinicalSessionRepeatUnit',
});

registerEnumType(ClinicalSessionRepeatEndMode, {
    name: 'ClinicalSessionRepeatEndMode',
});
