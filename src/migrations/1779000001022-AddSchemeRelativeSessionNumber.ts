import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchemeRelativeSessionNumber1779000001022 implements MigrationInterface {
    name = 'AddSchemeRelativeSessionNumber1779000001022';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE clinical_session_resource
            ADD COLUMN IF NOT EXISTS "schemeRelativeSessionNumber" integer;
        `);
        await queryRunner.query(`
            ALTER TABLE assessment
            ADD COLUMN IF NOT EXISTS "schemeRelativeSessionNumber" integer;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE assessment
            DROP COLUMN IF EXISTS "schemeRelativeSessionNumber";
        `);
        await queryRunner.query(`
            ALTER TABLE clinical_session_resource
            DROP COLUMN IF EXISTS "schemeRelativeSessionNumber";
        `);
    }
}
