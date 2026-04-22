import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBaseRolesAndPermissions1776888121327 implements MigrationInterface {
    name = 'CreateBaseRolesAndPermissions1776888121327';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Crear nuevos roles si no existen
        const insertRoles = `
            INSERT INTO role (name, code, hierarchy)
            SELECT name, code, hierarchy
            FROM (
                VALUES 
                    ('Patient', 'PATIENT', 10),
                    ('Caregiver', 'CAREGIVER', 10),
                    ('Therapist', 'THERAPIST', 50),
                    ('Supervisor', 'SUPERVISOR', 70)
            ) AS new_roles(name, code, hierarchy)
            WHERE NOT EXISTS (
                SELECT 1 FROM role WHERE role.code = new_roles.code
            );
        `;
        await queryRunner.query(insertRoles);

        // NOTA: Los permisos view_own_assessments y view_own_profile deben crearse 
        // en una migración separada o añadirse al enum systemPermissions.
        // Esta migración solo crea los roles. La asignación de permisos
        // se hará en otra migración cuando los permisos estén definidos.
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Eliminar roles en orden inverso de jerarquía
        await queryRunner.query(`
            DELETE FROM role 
            WHERE code IN ('PATIENT', 'CAREGIVER', 'THERAPIST', 'SUPERVISOR');
        `);
    }
}
