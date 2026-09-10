import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReportSessionAuditHardening1790600000000 implements MigrationInterface {
    name = 'ReportSessionAuditHardening1790600000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "report_session"
                ADD COLUMN IF NOT EXISTS "contextType" character varying,
                ADD COLUMN IF NOT EXISTS "contextParams" text,
                ADD COLUMN IF NOT EXISTS "closedBy" character varying
        `);

        await queryRunner.query(`
            UPDATE "report_session" session
            SET "patientId" = NULL
            WHERE session."patientId" IS NOT NULL
                AND NOT EXISTS (
                    SELECT 1
                    FROM "patient" patient
                    WHERE patient.id = session."patientId"
                )
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'FK_report_session_patient'
                ) THEN
                    ALTER TABLE "report_session"
                    ADD CONSTRAINT "FK_report_session_patient"
                    FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE SET NULL;
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_report_session_patient"
            ON "report_session" ("patientId")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_report_session_active_last_seen"
            ON "report_session" ("active", "lastSeenAt")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_report_session_active_last_seen"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_report_session_patient"`);
        await queryRunner.query(`
            ALTER TABLE "report_session"
            DROP CONSTRAINT IF EXISTS "FK_report_session_patient"
        `);
        await queryRunner.query(`
            ALTER TABLE "report_session"
                DROP COLUMN IF EXISTS "closedBy",
                DROP COLUMN IF EXISTS "contextParams",
                DROP COLUMN IF EXISTS "contextType"
        `);
    }
}
