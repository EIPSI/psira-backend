import { registerEnumType } from '@nestjs/graphql';

export enum NotificationChannel {
    EMAIL = 'EMAIL',
}

registerEnumType(NotificationChannel, {
    name: 'NotificationChannel',
});
