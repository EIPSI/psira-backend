import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionResourceReminderMinutes1779000001005
    implements MigrationInterface
{
    name = 'AddSessionResourceReminderMinutes1779000001005';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "scheme_resource_template"
            ADD COLUMN IF NOT EXISTS "reminderMinutes" text;
        `);
        await queryRunner.query(`
            ALTER TABLE "clinical_session_resource"
            ADD COLUMN IF NOT EXISTS "reminderMinutes" text;
        `);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "clinical_session_resource"
            DROP COLUMN IF EXISTS "reminderMinutes";
        `);
        await queryRunner.query(`
            ALTER TABLE "scheme_resource_template"
            DROP COLUMN IF EXISTS "reminderMinutes";
        `);
    }
}
