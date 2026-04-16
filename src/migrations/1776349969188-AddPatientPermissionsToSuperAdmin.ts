import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPatientPermissionsToSuperAdmin1776349969188 implements MigrationInterface {
    name = 'AddPatientPermissionsToSuperAdmin1776349969188';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Primero, asegurarnos de que los permisos existan (por si la migración ReportPermission no corrió)
        const insertPermissions = `
            INSERT INTO permission (name, "group")
            VALUES 
                ('view department patients', 'Patient Management'),
                ('view assigned patients', 'Patient Management')
            ON CONFLICT (name) DO NOTHING;
        `;
        await queryRunner.query(insertPermissions);

        // Asignar los permisos al rol SUPER_ADMIN
        const assignPermissions = `
            INSERT INTO role_permission ("roleId", "permissionId")
            SELECT r.id, p.id
            FROM role r
            CROSS JOIN permission p
            WHERE r.code = 'SUPER_ADMIN'
            AND p.name IN ('view department patients', 'view assigned patients')
            ON CONFLICT ("roleId", "permissionId") DO NOTHING;
        `;
        await queryRunner.query(assignPermissions);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Eliminar las asignaciones de permisos al rol SUPER_ADMIN
        await queryRunner.query(`
            DELETE FROM role_permission
            WHERE "roleId" IN (SELECT id FROM role WHERE code = 'SUPER_ADMIN')
            AND "permissionId" IN (
                SELECT id FROM permission 
                WHERE name IN ('view department patients', 'view assigned patients')
            );
        `);
    }
}
