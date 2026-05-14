import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDefaultEditableRolePermissions1777593006000 implements MigrationInterface {
    name = 'SeedDefaultEditableRolePermissions1777593006000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO role_permission ("roleId", "permissionId")
            SELECT r.id, p.id
            FROM (
                VALUES
                    ('PATIENT', 'view assessments'),
                    ('CAREGIVER', 'view assessments'),
                    ('THERAPIST', 'view patients'),
                    ('THERAPIST', 'view assigned patients'),
                    ('THERAPIST', 'manage patients'),
                    ('THERAPIST', 'view caregivers'),
                    ('THERAPIST', 'manage caregivers'),
                    ('THERAPIST', 'view assessments'),
                    ('THERAPIST', 'manage assessments'),
                    ('SUPERVISOR', 'view patients'),
                    ('SUPERVISOR', 'view department patients'),
                    ('SUPERVISOR', 'manage patients'),
                    ('SUPERVISOR', 'view caregivers'),
                    ('SUPERVISOR', 'manage caregivers'),
                    ('SUPERVISOR', 'view assessments'),
                    ('SUPERVISOR', 'manage assessments'),
                    ('SUPERVISOR', 'view reports'),
                    ('DEPARTMENT_ADMIN', 'view users'),
                    ('DEPARTMENT_ADMIN', 'manage users'),
                    ('DEPARTMENT_ADMIN', 'view patients'),
                    ('DEPARTMENT_ADMIN', 'view department patients'),
                    ('DEPARTMENT_ADMIN', 'manage patients'),
                    ('DEPARTMENT_ADMIN', 'delete patients'),
                    ('DEPARTMENT_ADMIN', 'view caregivers'),
                    ('DEPARTMENT_ADMIN', 'view all caregivers'),
                    ('DEPARTMENT_ADMIN', 'manage caregivers'),
                    ('DEPARTMENT_ADMIN', 'delete caregivers'),
                    ('DEPARTMENT_ADMIN', 'view assessments'),
                    ('DEPARTMENT_ADMIN', 'manage assessments'),
                    ('DEPARTMENT_ADMIN', 'delete assessments'),
                    ('DEPARTMENT_ADMIN', 'view reports'),
                    ('DEPARTMENT_ADMIN', 'manage reports'),
                    ('DEPARTMENT_ADMIN', 'view questionnaires'),
                    ('DEPARTMENT_ADMIN', 'manage questionnaires'),
                    ('DEPARTMENT_ADMIN', 'view questionnaire bundles'),
                    ('DEPARTMENT_ADMIN', 'manage questionnaire bundles'),
                    ('NO_ROLE', 'view assessments')
            ) AS defaults(role_code, permission_name)
            INNER JOIN role r ON r.code = defaults.role_code
            INNER JOIN permission p ON p.name = defaults.permission_name
            ON CONFLICT ("roleId", "permissionId") DO NOTHING;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM role_permission rp
            USING role r, permission p, (
                VALUES
                    ('PATIENT', 'view assessments'),
                    ('CAREGIVER', 'view assessments'),
                    ('THERAPIST', 'view patients'),
                    ('THERAPIST', 'view assigned patients'),
                    ('THERAPIST', 'manage patients'),
                    ('THERAPIST', 'view caregivers'),
                    ('THERAPIST', 'manage caregivers'),
                    ('THERAPIST', 'view assessments'),
                    ('THERAPIST', 'manage assessments'),
                    ('SUPERVISOR', 'view patients'),
                    ('SUPERVISOR', 'view department patients'),
                    ('SUPERVISOR', 'manage patients'),
                    ('SUPERVISOR', 'view caregivers'),
                    ('SUPERVISOR', 'manage caregivers'),
                    ('SUPERVISOR', 'view assessments'),
                    ('SUPERVISOR', 'manage assessments'),
                    ('SUPERVISOR', 'view reports'),
                    ('DEPARTMENT_ADMIN', 'view users'),
                    ('DEPARTMENT_ADMIN', 'manage users'),
                    ('DEPARTMENT_ADMIN', 'view patients'),
                    ('DEPARTMENT_ADMIN', 'view department patients'),
                    ('DEPARTMENT_ADMIN', 'manage patients'),
                    ('DEPARTMENT_ADMIN', 'delete patients'),
                    ('DEPARTMENT_ADMIN', 'view caregivers'),
                    ('DEPARTMENT_ADMIN', 'view all caregivers'),
                    ('DEPARTMENT_ADMIN', 'manage caregivers'),
                    ('DEPARTMENT_ADMIN', 'delete caregivers'),
                    ('DEPARTMENT_ADMIN', 'view assessments'),
                    ('DEPARTMENT_ADMIN', 'manage assessments'),
                    ('DEPARTMENT_ADMIN', 'delete assessments'),
                    ('DEPARTMENT_ADMIN', 'view reports'),
                    ('DEPARTMENT_ADMIN', 'manage reports'),
                    ('DEPARTMENT_ADMIN', 'view questionnaires'),
                    ('DEPARTMENT_ADMIN', 'manage questionnaires'),
                    ('DEPARTMENT_ADMIN', 'view questionnaire bundles'),
                    ('DEPARTMENT_ADMIN', 'manage questionnaire bundles'),
                    ('NO_ROLE', 'view assessments')
            ) AS defaults(role_code, permission_name)
            WHERE rp."roleId" = r.id
              AND rp."permissionId" = p.id
              AND r.code = defaults.role_code
              AND p.name = defaults.permission_name;
        `);
    }
}
