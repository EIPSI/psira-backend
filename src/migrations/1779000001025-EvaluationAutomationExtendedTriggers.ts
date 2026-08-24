import { MigrationInterface, QueryRunner } from 'typeorm';

export class EvaluationAutomationExtendedTriggers1779000001025 implements MigrationInterface {
    name = 'EvaluationAutomationExtendedTriggers1779000001025';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const triggerValues = [
            'last_login',
            'session_number',
            'treatment_finalization',
            'session_no_show_cancellation',
            'new_treatment',
        ];
        for (const value of triggerValues) {
            await queryRunner.query(`ALTER TYPE "evaluation_automation_triggerPoint_enum" ADD VALUE IF NOT EXISTS '${value}'`);
            await queryRunner.query(`ALTER TYPE "evaluation_automation_run_triggerPoint_enum" ADD VALUE IF NOT EXISTS '${value}'`);
        }

        const delayValues = ['HOURS', 'WEEKS', 'MONTHS', 'YEARS'];
        for (const value of delayValues) {
            await queryRunner.query(`ALTER TYPE "evaluation_automation_delayUnit_enum" ADD VALUE IF NOT EXISTS '${value}'`);
        }

        await queryRunner.query(`
            ALTER TABLE evaluation_automation
            ADD COLUMN IF NOT EXISTS "triggerSessionNumber" integer
        `);
        await queryRunner.query(`
            ALTER TABLE evaluation_automation
            ADD COLUMN IF NOT EXISTS "triggerReasonIds" text
        `);
        await queryRunner.query(`
            ALTER TABLE evaluation_automation
            ADD COLUMN IF NOT EXISTS "lastLoginInactiveDays" integer
        `);
        await queryRunner.query(`
            ALTER TABLE "user"
            ADD COLUMN IF NOT EXISTS "previousLastLoginAt" timestamp
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "previousLastLoginAt"`);
        await queryRunner.query(`ALTER TABLE evaluation_automation DROP COLUMN IF EXISTS "lastLoginInactiveDays"`);
        await queryRunner.query(`ALTER TABLE evaluation_automation DROP COLUMN IF EXISTS "triggerReasonIds"`);
        await queryRunner.query(`ALTER TABLE evaluation_automation DROP COLUMN IF EXISTS "triggerSessionNumber"`);
    }
}
