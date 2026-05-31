import { registerEnumType } from '@nestjs/graphql';

export enum CalendarOccurrenceType {
    CLINICAL_SESSION = 'CLINICAL_SESSION',
    INDEPENDENT_ASSESSMENT = 'INDEPENDENT_ASSESSMENT',
    SUPERVISION = 'SUPERVISION',
}

registerEnumType(CalendarOccurrenceType, {
    name: 'CalendarOccurrenceType',
});
