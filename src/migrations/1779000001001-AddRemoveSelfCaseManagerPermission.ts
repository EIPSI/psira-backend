import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRemoveSelfCaseManagerPermission1779000001001 implements MigrationInterface {
    name = 'AddRemoveSelfCaseManagerPermission1779000001001';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO permission (name, "group")
            SELECT 'remove self case manager', 'Patient Management'
            WHERE NOT EXISTS (
                SELECT 1 FROM permission WHERE name = 'remove self case manager'
            );
        `);

        await queryRunner.query(`
            INSERT INTO role_permission ("roleId", "permissionId")
            SELECT r.id, p.id
            FROM role r
            CROSS JOIN permission p
            WHERE r.code = 'SUPER_ADMIN'
            AND p.name = 'remove self case manager'
            ON CONFLICT ("roleId", "permissionId") DO NOTHING;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM role_permission
            WHERE "permissionId" IN (
                SELECT id FROM permission WHERE name = 'remove self case manager'
            );
        `);
        await queryRunner.query(`DELETE FROM permission WHERE name = 'remove self case manager';`);
    }
}
