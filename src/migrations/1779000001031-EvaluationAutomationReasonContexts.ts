import { MigrationInterface, QueryRunner } from 'typeorm';

export class EvaluationAutomationReasonContexts1779000001031 implements MigrationInterface {
    name = 'EvaluationAutomationReasonContexts1779000001031';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE evaluation_automation
            ADD COLUMN IF NOT EXISTS "triggerReasonContexts" text
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE evaluation_automation
            DROP COLUMN IF EXISTS "triggerReasonContexts"
        `);
    }
}
