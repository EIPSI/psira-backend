import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchemeEmailNotificationsAndStartMinute1779000001007
    implements MigrationInterface
{
    name = 'AddSchemeEmailNotificationsAndStartMinute1779000001007';

    async up(queryRunner: QueryRunner): Promise<void> {
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
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "independent_evaluation_template"
            DROP COLUMN IF EXISTS "startMinuteOfDay";
        `);
        await queryRunner.query(`
            ALTER TABLE "evaluation_scheme"
            DROP COLUMN IF EXISTS "mailTemplateId";
        `);
        await queryRunner.query(`
            ALTER TABLE "evaluation_scheme"
            DROP COLUMN IF EXISTS "emailNotificationsEnabled";
        `);
    }
}
