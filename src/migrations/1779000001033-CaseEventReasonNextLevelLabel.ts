import { MigrationInterface, QueryRunner } from 'typeorm';

export class CaseEventReasonNextLevelLabel1779000001033 implements MigrationInterface {
    name = 'CaseEventReasonNextLevelLabel1779000001033';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE case_event_reason
            ADD COLUMN IF NOT EXISTS "nextLevelLabel" character varying
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE case_event_reason
            DROP COLUMN IF EXISTS "nextLevelLabel"
        `);
    }
}
