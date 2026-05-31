import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFixedSchemeBuilderFields1779000001006
    implements MigrationInterface
{
    name = 'AddFixedSchemeBuilderFields1779000001006';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "evaluation_scheme"
            ADD COLUMN IF NOT EXISTS "durationDays" integer NOT NULL DEFAULT 7;
        `);
        await queryRunner.query(`
            ALTER TABLE "evaluation_scheme"
            ADD COLUMN IF NOT EXISTS "emailNotificationsEnabled" boolean NOT NULL DEFAULT true;
        `);
        await queryRunner.query(`
            ALTER TABLE "evaluation_scheme"
            ADD COLUMN IF NOT EXISTS "mailTemplateId" integer;
        `);
        await queryRunner.query(`
            ALTER TABLE "independent_evaluation_template"
            ADD COLUMN IF NOT EXISTS "startMinuteOfDay" integer;
        `);
        await queryRunner.query(`
            ALTER TABLE "independent_evaluation_template"
            ADD COLUMN IF NOT EXISTS "endMinuteOfDay" integer;
        `);
        await queryRunner.query(`
            ALTER TABLE "independent_evaluation_template"
            ADD COLUMN IF NOT EXISTS "triggerMode" character varying DEFAULT 'BLOCK_START';
        `);
        await queryRunner.query(`
            ALTER TABLE "independent_evaluation_template"
            ADD COLUMN IF NOT EXISTS "reminderMinutes" text;
        `);
        await queryRunner.query(`
            ALTER TABLE "independent_evaluation_template"
            ADD COLUMN IF NOT EXISTS "required" boolean NOT NULL DEFAULT false;
        `);
        await queryRunner.query(`
            ALTER TABLE "independent_evaluation_template"
            ADD COLUMN IF NOT EXISTS "singleResponse" boolean NOT NULL DEFAULT true;
        `);
        await queryRunner.query(`
            ALTER TABLE "independent_evaluation_template"
            ADD COLUMN IF NOT EXISTS "seedOrder" integer;
        `);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "independent_evaluation_template"
            DROP COLUMN IF EXISTS "seedOrder";
        `);
        await queryRunner.query(`
            ALTER TABLE "independent_evaluation_template"
            DROP COLUMN IF EXISTS "singleResponse";
        `);
        await queryRunner.query(`
            ALTER TABLE "independent_evaluation_template"
            DROP COLUMN IF EXISTS "required";
        `);
        await queryRunner.query(`
            ALTER TABLE "independent_evaluation_template"
            DROP COLUMN IF EXISTS "reminderMinutes";
        `);
        await queryRunner.query(`
            ALTER TABLE "independent_evaluation_template"
            DROP COLUMN IF EXISTS "triggerMode";
        `);
        await queryRunner.query(`
            ALTER TABLE "independent_evaluation_template"
            DROP COLUMN IF EXISTS "startMinuteOfDay";
        `);
        await queryRunner.query(`
            ALTER TABLE "independent_evaluation_template"
            DROP COLUMN IF EXISTS "endMinuteOfDay";
        `);
        await queryRunner.query(`
            ALTER TABLE "evaluation_scheme"
            DROP COLUMN IF EXISTS "mailTemplateId";
        `);
        await queryRunner.query(`
            ALTER TABLE "evaluation_scheme"
            DROP COLUMN IF EXISTS "emailNotificationsEnabled";
        `);
        await queryRunner.query(`
            ALTER TABLE "evaluation_scheme"
            DROP COLUMN IF EXISTS "durationDays";
        `);
    }
}
