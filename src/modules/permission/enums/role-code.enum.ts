import { registerEnumType } from "@nestjs/graphql";

export enum RoleCode {
    SUPER_ADMIN = 'SUPER_ADMIN',
    SUPERVISOR = 'SUPERVISOR',
    DEPARTMENT_ADMIN = 'DEPARTMENT_ADMIN',
    THERAPIST = 'THERAPIST',
    CAREGIVER = 'CAREGIVER',
    PATIENT = 'PATIENT',
    NO_ROLE = 'NO_ROLE',
}

registerEnumType(RoleCode, { name: 'RoleCode' });
