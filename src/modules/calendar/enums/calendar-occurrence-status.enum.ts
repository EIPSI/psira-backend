import { registerEnumType } from '@nestjs/graphql';

export enum CalendarOccurrenceStatus {
    SCHEDULED = 'SCHEDULED',
    OPEN = 'OPEN',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
    DETACHED = 'DETACHED',
}

registerEnumType(CalendarOccurrenceStatus, {
    name: 'CalendarOccurrenceStatus',
});
