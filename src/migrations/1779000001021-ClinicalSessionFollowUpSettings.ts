import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClinicalSessionFollowUpSettings1779000001021 implements MigrationInterface {
    name = 'ClinicalSessionFollowUpSettings1779000001021';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS clinical_session_follow_up_setting (
                id serial CONSTRAINT "PK_clinical_session_follow_up_setting" PRIMARY KEY,
                "editWindowDays" integer NOT NULL DEFAULT 7,
                "dashboardLookaheadDays" integer NOT NULL DEFAULT 1,
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
            );
        `);
        await queryRunner.query(`
            INSERT INTO clinical_session_follow_up_setting (id, "editWindowDays", "dashboardLookaheadDays")
            VALUES (1, 7, 1)
            ON CONFLICT (id) DO NOTHING;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS clinical_session_follow_up_setting;`);
    }
}
