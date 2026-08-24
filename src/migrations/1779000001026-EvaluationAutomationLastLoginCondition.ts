import { MigrationInterface, QueryRunner } from 'typeorm';

export class EvaluationAutomationLastLoginCondition1779000001026 implements MigrationInterface {
    name = 'EvaluationAutomationLastLoginCondition1779000001026';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE evaluation_automation
            ADD COLUMN IF NOT EXISTS "lastLoginInactiveDays" integer
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE evaluation_automation
            DROP COLUMN IF EXISTS "lastLoginInactiveDays"
        `);
    }
}
