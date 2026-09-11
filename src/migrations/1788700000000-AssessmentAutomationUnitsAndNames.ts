import { MigrationInterface, QueryRunner } from 'typeorm';

export class AssessmentAutomationUnitsAndNames1788700000000 implements MigrationInterface {
    name = 'AssessmentAutomationUnitsAndNames1788700000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "assessment"
            ADD COLUMN IF NOT EXISTS "name" character varying,
            ADD COLUMN IF NOT EXISTS "reminderUnit" character varying DEFAULT 'MINUTES'
        `);
        await queryRunner.query(`
            ALTER TABLE "evaluation_automation"
            ADD COLUMN IF NOT EXISTS "lastLoginConditionLogic" character varying DEFAULT 'AND',
            ADD COLUMN IF NOT EXISTS "lastLoginConditions" text,
            ADD COLUMN IF NOT EXISTS "schemeRandomizationRuleId" integer,
            ADD COLUMN IF NOT EXISTS "expirationUnit" character varying DEFAULT 'MINUTES',
            ADD COLUMN IF NOT EXISTS "reminderUnit" character varying DEFAULT 'MINUTES'
        `);
        await queryRunner.query(`
            ALTER TABLE "scheme_resource_template"
            ADD COLUMN IF NOT EXISTS "name" character varying,
            ADD COLUMN IF NOT EXISTS "availabilityDurationUnit" character varying DEFAULT 'MINUTES',
            ADD COLUMN IF NOT EXISTS "reminderUnit" character varying DEFAULT 'MINUTES'
        `);
        await queryRunner.query(`
            ALTER TABLE "independent_evaluation_template"
            ADD COLUMN IF NOT EXISTS "name" character varying,
            ADD COLUMN IF NOT EXISTS "availabilityDurationUnit" character varying DEFAULT 'MINUTES',
            ADD COLUMN IF NOT EXISTS "reminderUnit" character varying DEFAULT 'MINUTES'
        `);
        await queryRunner.query(`
            ALTER TABLE "clinical_session_resource"
            ADD COLUMN IF NOT EXISTS "name" character varying
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "clinical_session_resource"
            DROP COLUMN IF EXISTS "name"
        `);
        await queryRunner.query(`
            ALTER TABLE "independent_evaluation_template"
            DROP COLUMN IF EXISTS "reminderUnit",
            DROP COLUMN IF EXISTS "availabilityDurationUnit",
            DROP COLUMN IF EXISTS "name"
        `);
        await queryRunner.query(`
            ALTER TABLE "scheme_resource_template"
            DROP COLUMN IF EXISTS "reminderUnit",
            DROP COLUMN IF EXISTS "availabilityDurationUnit",
            DROP COLUMN IF EXISTS "name"
        `);
        await queryRunner.query(`
            ALTER TABLE "evaluation_automation"
            DROP COLUMN IF EXISTS "reminderUnit",
            DROP COLUMN IF EXISTS "expirationUnit",
            DROP COLUMN IF EXISTS "schemeRandomizationRuleId",
            DROP COLUMN IF EXISTS "lastLoginConditions",
            DROP COLUMN IF EXISTS "lastLoginConditionLogic"
        `);
        await queryRunner.query(`
            ALTER TABLE "assessment"
            DROP COLUMN IF EXISTS "reminderUnit",
            DROP COLUMN IF EXISTS "name"
        `);
    }
}
