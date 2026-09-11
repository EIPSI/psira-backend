import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssessmentReminderMinutes1779000001007
    implements MigrationInterface
{
    name = 'AddAssessmentReminderMinutes1779000001007';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "assessment"
            ADD COLUMN IF NOT EXISTS "reminderMinutes" text;
        `);
        await queryRunner.query(`
            ALTER TABLE "assessment"
            ADD COLUMN IF NOT EXISTS "sentReminderMinutes" text;
        `);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "assessment"
            DROP COLUMN IF EXISTS "sentReminderMinutes";
        `);
        await queryRunner.query(`
            ALTER TABLE "assessment"
            DROP COLUMN IF EXISTS "reminderMinutes";
        `);
    }
}
