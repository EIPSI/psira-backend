import { registerEnumType } from '@nestjs/graphql';

export enum NotificationFamily {
    ASSESSMENT = 'ASSESSMENT',
    CASE = 'CASE',
    AUTOMATION = 'AUTOMATION',
    INFORMED_CONSENT = 'INFORMED_CONSENT',
}

registerEnumType(NotificationFamily, {
    name: 'NotificationFamily',
});
