import { registerEnumType } from '@nestjs/graphql';

export enum AssignmentRequestStatus {
    PENDING = 'PENDING',
    ACCEPTED = 'ACCEPTED',
    REJECTED = 'REJECTED',
    CANCELLED = 'CANCELLED',
}

registerEnumType(AssignmentRequestStatus, { name: 'AssignmentRequestStatus' });
