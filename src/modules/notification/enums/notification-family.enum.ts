import { registerEnumType } from '@nestjs/graphql';

export enum NotificationFamily {
    ASSESSMENT = 'ASSESSMENT',
    CASE = 'CASE',
    AUTOMATION = 'AUTOMATION',
}

registerEnumType(NotificationFamily, {
    name: 'NotificationFamily',
});
