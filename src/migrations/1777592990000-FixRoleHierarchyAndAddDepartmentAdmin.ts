import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixRoleHierarchyAndAddDepartmentAdmin1777592990000 implements MigrationInterface {
    name = 'FixRoleHierarchyAndAddDepartmentAdmin1777592990000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Crear rol DEPARTMENT_ADMIN si no existe
        await queryRunner.query(`
            INSERT INTO role (name, code, hierarchy, "createdAt", "updatedAt")
            SELECT 'Department Admin', 'DEPARTMENT_ADMIN', 400, NOW(), NOW()
            WHERE NOT EXISTS (SELECT 1 FROM role WHERE code = 'DEPARTMENT_ADMIN');
        `);

        // Actualizar jerarquías de todos los roles del sistema
        await queryRunner.query(`UPDATE role SET hierarchy = 1 WHERE code = 'SUPER_ADMIN';`);
        await queryRunner.query(`UPDATE role SET hierarchy = 300 WHERE code = 'SUPERVISOR';`);
        await queryRunner.query(`UPDATE role SET hierarchy = 400 WHERE code = 'DEPARTMENT_ADMIN';`);
        await queryRunner.query(`UPDATE role SET hierarchy = 500 WHERE code = 'THERAPIST';`);
        await queryRunner.query(`UPDATE role SET hierarchy = 600 WHERE code = 'CAREGIVER';`);
        await queryRunner.query(`UPDATE role SET hierarchy = 700 WHERE code = 'PATIENT';`);
        await queryRunner.query(`UPDATE role SET hierarchy = 999 WHERE code = 'NO_ROLE';`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Eliminar rol DEPARTMENT_ADMIN
        await queryRunner.query(`DELETE FROM role WHERE code = 'DEPARTMENT_ADMIN';`);
    }
}
