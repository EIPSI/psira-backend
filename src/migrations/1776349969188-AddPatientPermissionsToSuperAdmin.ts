import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPatientPermissionsToSuperAdmin1776349969188 implements MigrationInterface {
    name = 'AddPatientPermissionsToSuperAdmin1776349969188';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Usamos una subconsulta con NOT EXISTS para evitar el error de ON CONFLICT
        const insertPermissions = `
            INSERT INTO permission (name, "group")
            SELECT name, "group"
            FROM (
                VALUES 
                    ('view department patients', 'Patient Management'),
                    ('view assigned patients', 'Patient Management')
            ) AS new_perms(name, "group")
            WHERE NOT EXISTS (
                SELECT 1 FROM permission WHERE permission.name = new_perms.name
            );
        `;
        await queryRunner.query(insertPermissions);

        // ... el resto de la migración (asignación a roles, etc.)
    }
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
