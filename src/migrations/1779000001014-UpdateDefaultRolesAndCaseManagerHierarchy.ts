import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateDefaultRolesAndCaseManagerHierarchy1779000001014 implements MigrationInterface {
    name = 'UpdateDefaultRolesAndCaseManagerHierarchy1779000001014';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE role SET hierarchy = 400 WHERE code = 'THERAPIST';`);
        await queryRunner.query(`UPDATE role SET hierarchy = 400 WHERE code = 'SUPERVISOR';`);
        await queryRunner.query(`UPDATE role SET hierarchy = 300 WHERE code = 'DEPARTMENT_ADMIN';`);

        await queryRunner.query(`
            DELETE FROM role_permission
            WHERE "roleId" IN (SELECT id FROM role WHERE code = 'NO_ROLE' OR name = 'Default');
        `);
        await queryRunner.query(`
            DELETE FROM user_role
            WHERE "roleId" IN (SELECT id FROM role WHERE code = 'NO_ROLE' OR name = 'Default');
        `);
        await queryRunner.query(`DELETE FROM role WHERE code = 'NO_ROLE' OR name = 'Default';`);

        await queryRunner.query(`
            INSERT INTO setting (key, value)
            SELECT 'patientCaseManagerAssignableHierarchyRank', '500'
            WHERE NOT EXISTS (
                SELECT 1 FROM setting WHERE key = 'patientCaseManagerAssignableHierarchyRank'
            );
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE role SET hierarchy = 500 WHERE code = 'THERAPIST';`);
        await queryRunner.query(`UPDATE role SET hierarchy = 300 WHERE code = 'SUPERVISOR';`);
        await queryRunner.query(`UPDATE role SET hierarchy = 400 WHERE code = 'DEPARTMENT_ADMIN';`);
    }
}
