import { registerEnumType } from '@nestjs/graphql';

export enum CalendarEventType {
    SESSION = 'SESSION',
    ASSESSMENT = 'ASSESSMENT',
}

registerEnumType(CalendarEventType, {
    name: 'CalendarEventType',
});
