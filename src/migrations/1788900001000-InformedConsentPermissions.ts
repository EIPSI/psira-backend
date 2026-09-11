import { MigrationInterface, QueryRunner } from 'typeorm';

const permissions = [
    ['view informed consent models', 'Informed Consent'],
    ['manage informed consent models', 'Informed Consent'],
    ['view informed consent management', 'Informed Consent'],
    ['manage informed consent management', 'Informed Consent'],
    ['view informed consent responses', 'Informed Consent'],
    ['review informed consent responses', 'Informed Consent'],
];

export class InformedConsentPermissions1788900001000 implements MigrationInterface {
    name = 'InformedConsentPermissions1788900001000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO permission (name, "group")
            SELECT new_permissions.name, new_permissions."group"
            FROM (
                VALUES
                    ${permissions.map(([name, group]) => `('${name}', '${group}')`).join(',\n                    ')}
            ) AS new_permissions(name, "group")
            WHERE NOT EXISTS (
                SELECT 1 FROM permission WHERE permission.name = new_permissions.name
            )
        `);

        await queryRunner.query(`
            INSERT INTO role_permission ("roleId", "permissionId")
            SELECT r.id, p.id
            FROM role r
            CROSS JOIN permission p
            WHERE r.code IN ('SUPER_ADMIN', 'DEPARTMENT_ADMIN')
              AND p.name IN (${permissions.map(([name]) => `'${name}'`).join(', ')})
            ON CONFLICT ("roleId", "permissionId") DO NOTHING
        `);

        await queryRunner.query(`
            INSERT INTO role_permission ("roleId", "permissionId")
            SELECT r.id, p.id
            FROM role r
            CROSS JOIN permission p
            WHERE r.code IN ('SUPERVISOR', 'THERAPIST')
              AND p.name IN ('view informed consent responses', 'review informed consent responses')
            ON CONFLICT ("roleId", "permissionId") DO NOTHING
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM role_permission
            WHERE "permissionId" IN (
                SELECT id FROM permission
                WHERE name IN (${permissions.map(([name]) => `'${name}'`).join(', ')})
            )
        `);
        await queryRunner.query(`
            DELETE FROM permission
            WHERE name IN (${permissions.map(([name]) => `'${name}'`).join(', ')})
        `);
    }
}
