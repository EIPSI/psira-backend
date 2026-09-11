import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClinicalSettingsDashboardLookahead1789500000000 implements MigrationInterface {
    name = 'ClinicalSettingsDashboardLookahead1789500000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE clinical_session_follow_up_setting
            ADD COLUMN IF NOT EXISTS "dashboardLookaheadDays" integer NOT NULL DEFAULT 1;
        `);
        await queryRunner.query(`
            INSERT INTO clinical_session_follow_up_setting (id, "editWindowDays", "dashboardLookaheadDays")
            VALUES (1, 7, 1)
            ON CONFLICT (id) DO UPDATE SET
                "dashboardLookaheadDays" = COALESCE(clinical_session_follow_up_setting."dashboardLookaheadDays", 1);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE clinical_session_follow_up_setting
            DROP COLUMN IF EXISTS "dashboardLookaheadDays";
        `);
    }
}
