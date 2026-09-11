import { MigrationInterface, QueryRunner } from 'typeorm';

export class AssessmentSessionManagementPermissions1779000001019 implements MigrationInterface {
    name = 'AssessmentSessionManagementPermissions1779000001019';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO permission (name, "group")
            SELECT permission_data.name, permission_data."group"
            FROM (
                VALUES
                    ('manage department assessments', 'Assessments'),
                    ('manage all assessments', 'Assessments')
            ) AS permission_data(name, "group")
            WHERE NOT EXISTS (
                SELECT 1 FROM permission
                WHERE permission.name = permission_data.name
            );
        `);

        await queryRunner.query(`
            INSERT INTO role_permission ("roleId", "permissionId")
            SELECT r.id, p.id
            FROM role r
            CROSS JOIN permission p
            WHERE r.code = 'SUPER_ADMIN'
              AND p.name IN ('manage department assessments', 'manage all assessments')
            ON CONFLICT ("roleId", "permissionId") DO NOTHING;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM role_permission
            WHERE "permissionId" IN (
                SELECT id FROM permission
                WHERE name IN ('manage department assessments', 'manage all assessments')
            );
        `);
        await queryRunner.query(`
            DELETE FROM permission
            WHERE name IN ('manage department assessments', 'manage all assessments');
        `);
    }
}
