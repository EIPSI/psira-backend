import { registerEnumType } from '@nestjs/graphql';

export enum AssignmentRequestKind {
    CASE_MANAGER = 'CASE_MANAGER',
    SUPERVISOR = 'SUPERVISOR',
}

registerEnumType(AssignmentRequestKind, { name: 'AssignmentRequestKind' });
