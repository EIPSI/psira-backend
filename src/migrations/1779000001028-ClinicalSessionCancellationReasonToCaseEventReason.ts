import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClinicalSessionCancellationReasonToCaseEventReason1779000001028 implements MigrationInterface {
    name = 'ClinicalSessionCancellationReasonToCaseEventReason1779000001028';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE clinical_session
                DROP CONSTRAINT IF EXISTS "FK_clinical_session_cancellation_reason";
        `);
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_clinical_session_case_event_reason'
                ) THEN
                    ALTER TABLE clinical_session
                        ADD CONSTRAINT "FK_clinical_session_case_event_reason"
                        FOREIGN KEY ("cancellationReasonId")
                        REFERENCES case_event_reason(id)
                        ON DELETE SET NULL;
                END IF;
            END
            $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE clinical_session
                DROP CONSTRAINT IF EXISTS "FK_clinical_session_case_event_reason";
        `);
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_clinical_session_cancellation_reason'
                ) THEN
                    ALTER TABLE clinical_session
                        ADD CONSTRAINT "FK_clinical_session_cancellation_reason"
                        FOREIGN KEY ("cancellationReasonId")
                        REFERENCES clinical_session_cancellation_reason(id)
                        ON DELETE SET NULL;
                END IF;
            END
            $$;
        `);
    }
}
