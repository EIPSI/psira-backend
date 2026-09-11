import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClinicalSessionHistory1779000001004 implements MigrationInterface {
    name = 'AddClinicalSessionHistory1779000001004';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE clinical_session
                ADD COLUMN IF NOT EXISTS "clinicalHistory" text;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE clinical_session
                DROP COLUMN IF EXISTS "clinicalHistory";
        `);
    }
}
