import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClinicalSessionCancellationReasons1779000001016 implements MigrationInterface {
    name = 'ClinicalSessionCancellationReasons1779000001016';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_type WHERE typname = 'clinical_session_cancellation_type_enum'
                ) THEN
                    CREATE TYPE "clinical_session_cancellation_type_enum"
                        AS ENUM ('RESCHEDULED', 'NO_SHOW');
                END IF;
            END
            $$;
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_type WHERE typname = 'clinical_session_cancellation_label_enum'
                ) THEN
                    CREATE TYPE "clinical_session_cancellation_label_enum"
                        AS ENUM ('REPROGRAMADA', 'CANCELADA');
                END IF;
            END
            $$;
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS clinical_session_cancellation_reason (
                id SERIAL NOT NULL,
                label varchar NOT NULL,
                "parentId" integer,
                active boolean NOT NULL DEFAULT true,
                "sortOrder" integer NOT NULL DEFAULT 0,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_clinical_session_cancellation_reason" PRIMARY KEY (id),
                CONSTRAINT "FK_clinical_session_cancellation_reason_parent"
                    FOREIGN KEY ("parentId")
                    REFERENCES clinical_session_cancellation_reason(id)
                    ON DELETE SET NULL
            );
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_clinical_session_cancellation_reason_parent"
                ON clinical_session_cancellation_reason ("parentId");
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_clinical_session_cancellation_reason_active"
                ON clinical_session_cancellation_reason (active);
        `);

        await queryRunner.query(`
            ALTER TABLE clinical_session
                ADD COLUMN IF NOT EXISTS "cancellationType" "clinical_session_cancellation_type_enum",
                ADD COLUMN IF NOT EXISTS "cancellationLabel" "clinical_session_cancellation_label_enum",
                ADD COLUMN IF NOT EXISTS "cancellationReasonId" integer,
                ADD COLUMN IF NOT EXISTS "cancellationReasonSnapshot" text,
                ADD COLUMN IF NOT EXISTS "cancellationComment" text,
                ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP,
                ADD COLUMN IF NOT EXISTS "cancelledSessionNumber" integer,
                ADD COLUMN IF NOT EXISTS "cancelledStartAt" TIMESTAMP;
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'FK_clinical_session_cancellation_reason'
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

        await queryRunner.query(`
            WITH root_patient AS (
                INSERT INTO clinical_session_cancellation_reason (label, "parentId", active, "sortOrder")
                SELECT 'Paciente', NULL, true, 10
                WHERE NOT EXISTS (
                    SELECT 1 FROM clinical_session_cancellation_reason
                    WHERE label = 'Paciente' AND "parentId" IS NULL
                )
                RETURNING id
            ),
            patient AS (
                SELECT id FROM root_patient
                UNION
                SELECT id FROM clinical_session_cancellation_reason
                WHERE label = 'Paciente' AND "parentId" IS NULL
                LIMIT 1
            )
            INSERT INTO clinical_session_cancellation_reason (label, "parentId", active, "sortOrder")
            SELECT child.label, patient.id, true, child."sortOrder"
            FROM patient
            CROSS JOIN (VALUES
                ('No asistió', 10),
                ('Avisó tarde', 20)
            ) AS child(label, "sortOrder")
            WHERE NOT EXISTS (
                SELECT 1 FROM clinical_session_cancellation_reason existing
                WHERE existing.label = child.label AND existing."parentId" = patient.id
            );
        `);

        await queryRunner.query(`
            WITH root_therapist AS (
                INSERT INTO clinical_session_cancellation_reason (label, "parentId", active, "sortOrder")
                SELECT 'Terapeuta', NULL, true, 20
                WHERE NOT EXISTS (
                    SELECT 1 FROM clinical_session_cancellation_reason
                    WHERE label = 'Terapeuta' AND "parentId" IS NULL
                )
                RETURNING id
            ),
            therapist AS (
                SELECT id FROM root_therapist
                UNION
                SELECT id FROM clinical_session_cancellation_reason
                WHERE label = 'Terapeuta' AND "parentId" IS NULL
                LIMIT 1
            )
            INSERT INTO clinical_session_cancellation_reason (label, "parentId", active, "sortOrder")
            SELECT child.label, therapist.id, true, child."sortOrder"
            FROM therapist
            CROSS JOIN (VALUES
                ('Enfermedad', 10),
                ('Emergencia', 20)
            ) AS child(label, "sortOrder")
            WHERE NOT EXISTS (
                SELECT 1 FROM clinical_session_cancellation_reason existing
                WHERE existing.label = child.label AND existing."parentId" = therapist.id
            );
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE clinical_session
                DROP CONSTRAINT IF EXISTS "FK_clinical_session_cancellation_reason";
        `);
        await queryRunner.query(`
            ALTER TABLE clinical_session
                DROP COLUMN IF EXISTS "cancelledStartAt",
                DROP COLUMN IF EXISTS "cancelledSessionNumber",
                DROP COLUMN IF EXISTS "cancelledAt",
                DROP COLUMN IF EXISTS "cancellationComment",
                DROP COLUMN IF EXISTS "cancellationReasonSnapshot",
                DROP COLUMN IF EXISTS "cancellationReasonId",
                DROP COLUMN IF EXISTS "cancellationLabel",
                DROP COLUMN IF EXISTS "cancellationType";
        `);
        await queryRunner.query(`DROP TABLE IF EXISTS clinical_session_cancellation_reason;`);
        await queryRunner.query(`DROP TYPE IF EXISTS "clinical_session_cancellation_label_enum";`);
        await queryRunner.query(`DROP TYPE IF EXISTS "clinical_session_cancellation_type_enum";`);
    }
}
