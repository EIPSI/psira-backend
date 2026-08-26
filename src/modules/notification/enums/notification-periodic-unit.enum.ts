import { registerEnumType } from '@nestjs/graphql';

export enum NotificationPeriodicUnit {
    DAYS = 'DAYS',
    WEEKS = 'WEEKS',
    MONTHS = 'MONTHS',
}

registerEnumType(NotificationPeriodicUnit, {
    name: 'NotificationPeriodicUnit',
});
