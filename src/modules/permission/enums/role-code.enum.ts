import { registerEnumType } from "@nestjs/graphql";

export enum RoleCode {
    SUPER_ADMIN = 'SUPER_ADMIN',
    DEPARTMENT_ADMIN = 'DEPARTMENT_ADMIN',
    THERAPIST = 'THERAPIST',
    NO_ROLE = 'NO_ROLE',
}

registerEnumType(RoleCode, { name: 'RoleCode' });
