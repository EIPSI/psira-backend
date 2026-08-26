import { registerEnumType } from '@nestjs/graphql';

export enum NotificationLogStatus {
    SENT = 'SENT',
    FAILED = 'FAILED',
    SKIPPED_NO_CONFIGURATION = 'SKIPPED_NO_CONFIGURATION',
    SKIPPED_DISABLED = 'SKIPPED_DISABLED',
    SKIPPED_RECIPIENT_OPTED_OUT = 'SKIPPED_RECIPIENT_OPTED_OUT',
}

registerEnumType(NotificationLogStatus, {
    name: 'NotificationLogStatus',
});
