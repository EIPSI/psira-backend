import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssignAnyAssessmentUserPermission1777593004000 implements MigrationInterface {
    name = 'AddAssignAnyAssessmentUserPermission1777593004000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO permission (name, "group")
            SELECT 'assign any assessment user', 'Assessments'
            WHERE NOT EXISTS (
                SELECT 1 FROM permission WHERE name = 'assign any assessment user'
            );
        `);

        await queryRunner.query(`
            INSERT INTO role_permission ("roleId", "permissionId")
            SELECT r.id, p.id
            FROM role r
            CROSS JOIN permission p
            WHERE r.code = 'SUPER_ADMIN'
            AND p.name = 'assign any assessment user'
            ON CONFLICT ("roleId", "permissionId") DO NOTHING;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM role_permission
            WHERE "permissionId" IN (
                SELECT id FROM permission WHERE name = 'assign any assessment user'
            );
        `);
        await queryRunner.query(`DELETE FROM permission WHERE name = 'assign any assessment user';`);
    }
}
