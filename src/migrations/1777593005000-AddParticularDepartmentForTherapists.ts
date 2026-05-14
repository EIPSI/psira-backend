import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddParticularDepartmentForTherapists1777593005000 implements MigrationInterface {
    name = 'AddParticularDepartmentForTherapists1777593005000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO department (name, description, active, "createdAt", "updatedAt")
            SELECT 'Particular', 'Default department for private therapists', true, NOW(), NOW()
            WHERE NOT EXISTS (
                SELECT 1 FROM department WHERE name = 'Particular'
            );
        `);

        await queryRunner.query(`
            INSERT INTO user_department ("userId", "departmentId")
            SELECT ur."userId", d.id
            FROM user_role ur
            INNER JOIN role r ON r.id = ur."roleId"
            CROSS JOIN department d
            WHERE r.code = 'THERAPIST'
            AND d.name = 'Particular'
            ON CONFLICT ("userId", "departmentId") DO NOTHING;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM user_department
            WHERE "departmentId" IN (
                SELECT id FROM department WHERE name = 'Particular'
            );
        `);
        await queryRunner.query(`DELETE FROM department WHERE name = 'Particular';`);
    }
}
