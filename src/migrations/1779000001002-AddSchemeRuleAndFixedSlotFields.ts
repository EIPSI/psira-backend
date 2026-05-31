import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchemeRuleAndFixedSlotFields1779000001002 implements MigrationInterface {
    name = 'AddSchemeRuleAndFixedSlotFields1779000001002';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "scheme_resource_template"
            ADD COLUMN IF NOT EXISTS "sessionSelector" character varying,
            ADD COLUMN IF NOT EXISTS "everyNSessions" integer,
            ADD COLUMN IF NOT EXISTS "startSessionNumber" integer,
            ADD COLUMN IF NOT EXISTS "endSessionNumber" integer;
        `);

        await queryRunner.query(`
            ALTER TABLE "independent_evaluation_template"
            ADD COLUMN IF NOT EXISTS "relativeDay" integer,
            ADD COLUMN IF NOT EXISTS "relativeMinuteOfDay" integer,
            ADD COLUMN IF NOT EXISTS "durationMinutes" integer,
            ADD COLUMN IF NOT EXISTS "availabilityDurationMinutes" integer;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "independent_evaluation_template"
            DROP COLUMN IF EXISTS "availabilityDurationMinutes",
            DROP COLUMN IF EXISTS "durationMinutes",
            DROP COLUMN IF EXISTS "relativeMinuteOfDay",
            DROP COLUMN IF EXISTS "relativeDay";
        `);

        await queryRunner.query(`
            ALTER TABLE "scheme_resource_template"
            DROP COLUMN IF EXISTS "endSessionNumber",
            DROP COLUMN IF EXISTS "startSessionNumber",
            DROP COLUMN IF EXISTS "everyNSessions",
            DROP COLUMN IF EXISTS "sessionSelector";
        `);
    }
}
