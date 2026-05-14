import { MigrationInterface, QueryRunner } from 'typeorm';

export class GrantAssessmentViewToAllRoles1777593002000 implements MigrationInterface {
    name = 'GrantAssessmentViewToAllRoles1777593002000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO role_permission ("roleId", "permissionId")
            SELECT r.id, p.id
            FROM role r
            CROSS JOIN permission p
            WHERE p.name = 'view assessments'
            ON CONFLICT ("roleId", "permissionId") DO NOTHING;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM role_permission
            WHERE "permissionId" IN (
                SELECT id FROM permission WHERE name = 'view assessments'
            );
        `);
    }
}
