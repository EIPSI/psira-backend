import { MigrationInterface, QueryRunner } from 'typeorm';

export class TreatmentCyclesAndCaseEventReasons1779000001023 implements MigrationInterface {
    name = 'TreatmentCyclesAndCaseEventReasons1779000001023';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_type WHERE typname = 'treatment_cycle_kind_enum'
                ) THEN
                    CREATE TYPE "treatment_cycle_kind_enum"
                        AS ENUM ('CLINICAL', 'SUPERVISION');
                END IF;
            END
            $$;
        `);
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_type WHERE typname = 'treatment_cycle_status_enum'
                ) THEN
                    CREATE TYPE "treatment_cycle_status_enum"
                        AS ENUM ('ACTIVE', 'FINALIZED', 'FINALIZATION_CANCELLED');
                END IF;
            END
            $$;
        `);
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_type WHERE typname = 'case_event_reason_context_enum'
                ) THEN
                    CREATE TYPE "case_event_reason_context_enum"
                        AS ENUM ('SESSION_CANCELLATION', 'TREATMENT_FINALIZATION', 'NEW_TREATMENT');
                END IF;
            END
            $$;
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS case_event_reason (
                id SERIAL NOT NULL,
                context "case_event_reason_context_enum" NOT NULL,
                label varchar NOT NULL,
                "parentId" integer,
                "departmentId" integer,
                active boolean NOT NULL DEFAULT true,
                "sortOrder" integer NOT NULL DEFAULT 0,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_case_event_reason" PRIMARY KEY (id)
            );
        `);
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_case_event_reason_parent'
                ) THEN
                    ALTER TABLE case_event_reason
                        ADD CONSTRAINT "FK_case_event_reason_parent"
                        FOREIGN KEY ("parentId")
                        REFERENCES case_event_reason(id)
                        ON DELETE SET NULL;
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_case_event_reason_department'
                ) THEN
                    ALTER TABLE case_event_reason
                        ADD CONSTRAINT "FK_case_event_reason_department"
                        FOREIGN KEY ("departmentId")
                        REFERENCES department(id)
                        ON DELETE CASCADE;
                END IF;
            END
            $$;
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_case_event_reason_context_parent"
                ON case_event_reason (context, "parentId");
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_case_event_reason_department"
                ON case_event_reason ("departmentId");
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_case_event_reason_unique_sibling"
                ON case_event_reason (
                    context,
                    lower(label),
                    COALESCE("parentId", 0),
                    COALESCE("departmentId", 0)
                );
        `);

        await this.seedReasonTree(queryRunner, 'SESSION_CANCELLATION', [
            ['Paciente', null, 10],
            ['No asistio', 'Paciente', 10],
            ['Aviso tarde', 'Paciente', 20],
            ['Terapeuta', null, 20],
            ['Enfermedad', 'Terapeuta', 10],
            ['Emergencia', 'Terapeuta', 20],
        ]);
        await this.seedReasonTree(queryRunner, 'TREATMENT_FINALIZATION', [
            ['decision unilateral', null, 10],
            ['terapeuta', 'decision unilateral', 10],
            ['derivacion', 'terapeuta', 10],
            ['salud', 'terapeuta', 20],
            ['causas externas', 'terapeuta', 30],
            ['paciente', 'decision unilateral', 20],
            ['salud', 'paciente', 10],
            ['causas externas', 'paciente', 20],
            ['injustificado', 'paciente', 30],
            ['factores economicos', 'paciente', 40],
            ['acordado', null, 20],
            ['derivacion', 'acordado', 10],
            ['cumplimiento de objetivos', 'acordado', 20],
            ['otros motivos', null, 90],
        ]);
        await this.seedReasonTree(queryRunner, 'NEW_TREATMENT', [
            ['retorno por demanda espontanea', null, 10],
            ['derivacion', null, 20],
            ['continuidad posterior a interrupcion', null, 30],
            ['cambio de necesidad clinica', null, 40],
            ['otros motivos', null, 90],
        ]);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS treatment_cycle (
                id SERIAL NOT NULL,
                "cycleKind" "treatment_cycle_kind_enum" NOT NULL,
                status "treatment_cycle_status_enum" NOT NULL DEFAULT 'ACTIVE',
                "cycleNumber" integer NOT NULL,
                "patientId" integer,
                "therapistId" integer,
                "startedAt" TIMESTAMP NOT NULL,
                "finalizedAt" TIMESTAMP,
                "finalizationReasonId" integer,
                "finalizationReasonSnapshot" text,
                "finalizationOtherReason" text,
                "finalizationNote" text,
                "newTreatmentReasonId" integer,
                "newTreatmentReasonSnapshot" text,
                "newTreatmentOtherReason" text,
                "newTreatmentNote" text,
                "daysSincePreviousFinalization" integer,
                "previousCycleCount" integer NOT NULL DEFAULT 0,
                "lastClinicalSessionId" integer,
                "lastSessionNumber" integer,
                "finalizationCancelledAt" TIMESTAMP,
                "finalizationCancellationNote" text,
                "finalizationUndoExpiresAt" TIMESTAMP,
                "finalizationSnapshot" jsonb,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_treatment_cycle" PRIMARY KEY (id)
            );
        `);
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_treatment_cycle_patient'
                ) THEN
                    ALTER TABLE treatment_cycle
                        ADD CONSTRAINT "FK_treatment_cycle_patient"
                        FOREIGN KEY ("patientId")
                        REFERENCES patient(id)
                        ON DELETE CASCADE;
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_treatment_cycle_therapist'
                ) THEN
                    ALTER TABLE treatment_cycle
                        ADD CONSTRAINT "FK_treatment_cycle_therapist"
                        FOREIGN KEY ("therapistId")
                        REFERENCES "user"(id)
                        ON DELETE CASCADE;
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_treatment_cycle_finalization_reason'
                ) THEN
                    ALTER TABLE treatment_cycle
                        ADD CONSTRAINT "FK_treatment_cycle_finalization_reason"
                        FOREIGN KEY ("finalizationReasonId")
                        REFERENCES case_event_reason(id)
                        ON DELETE SET NULL;
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_treatment_cycle_new_treatment_reason'
                ) THEN
                    ALTER TABLE treatment_cycle
                        ADD CONSTRAINT "FK_treatment_cycle_new_treatment_reason"
                        FOREIGN KEY ("newTreatmentReasonId")
                        REFERENCES case_event_reason(id)
                        ON DELETE SET NULL;
                END IF;
            END
            $$;
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_treatment_cycle_active_patient"
                ON treatment_cycle ("patientId", "cycleKind")
                WHERE status = 'ACTIVE' AND "patientId" IS NOT NULL;
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_treatment_cycle_active_therapist"
                ON treatment_cycle ("therapistId", "cycleKind")
                WHERE status = 'ACTIVE' AND "therapistId" IS NOT NULL;
        `);

        await queryRunner.query(`
            ALTER TABLE clinical_session
                ADD COLUMN IF NOT EXISTS "treatmentCycleId" integer;
        `);
        await queryRunner.query(`
            ALTER TABLE assessment
                ADD COLUMN IF NOT EXISTS "treatmentCycleId" integer;
        `);

        await queryRunner.query(`
            WITH clinical_sources AS (
                SELECT
                    p.id AS "patientId",
                    MIN(COALESCE(occurrence."startAt", assessment."deliveryDate", assessment.date, assessment."createdAt")) AS "startedAt"
                FROM patient p
                LEFT JOIN clinical_session session
                    ON session."patientId" = p.id
                    AND session."sessionKind" = 'CLINICAL'
                LEFT JOIN calendar_occurrence occurrence
                    ON occurrence.id = session."calendarOccurrenceId"
                LEFT JOIN assessment assessment
                    ON assessment."patientId" = p.id
                WHERE session.id IS NOT NULL OR assessment.id IS NOT NULL
                GROUP BY p.id
            )
            INSERT INTO treatment_cycle (
                "cycleKind",
                status,
                "cycleNumber",
                "patientId",
                "startedAt",
                "previousCycleCount"
            )
            SELECT
                'CLINICAL',
                'ACTIVE',
                1,
                source."patientId",
                COALESCE(source."startedAt", now()),
                0
            FROM clinical_sources source
            WHERE NOT EXISTS (
                SELECT 1 FROM treatment_cycle existing
                WHERE existing."cycleKind" = 'CLINICAL'
                    AND existing."patientId" = source."patientId"
            );
        `);
        await queryRunner.query(`
            WITH supervision_sources AS (
                SELECT
                    session."therapistId",
                    MIN(occurrence."startAt") AS "startedAt"
                FROM clinical_session session
                INNER JOIN calendar_occurrence occurrence
                    ON occurrence.id = session."calendarOccurrenceId"
                WHERE session."sessionKind" = 'SUPERVISION'
                    AND session."therapistId" IS NOT NULL
                GROUP BY session."therapistId"
            )
            INSERT INTO treatment_cycle (
                "cycleKind",
                status,
                "cycleNumber",
                "therapistId",
                "startedAt",
                "previousCycleCount"
            )
            SELECT
                'SUPERVISION',
                'ACTIVE',
                1,
                source."therapistId",
                COALESCE(source."startedAt", now()),
                0
            FROM supervision_sources source
            WHERE NOT EXISTS (
                SELECT 1 FROM treatment_cycle existing
                WHERE existing."cycleKind" = 'SUPERVISION'
                    AND existing."therapistId" = source."therapistId"
            );
        `);
        await queryRunner.query(`
            UPDATE clinical_session session
            SET "treatmentCycleId" = cycle.id
            FROM treatment_cycle cycle
            WHERE session."treatmentCycleId" IS NULL
                AND cycle.status = 'ACTIVE'
                AND (
                    (
                        session."sessionKind" = 'CLINICAL'
                        AND cycle."cycleKind" = 'CLINICAL'
                        AND cycle."patientId" = session."patientId"
                    )
                    OR (
                        session."sessionKind" = 'SUPERVISION'
                        AND cycle."cycleKind" = 'SUPERVISION'
                        AND cycle."therapistId" = session."therapistId"
                    )
                );
        `);
        await queryRunner.query(`
            UPDATE assessment assessment
            SET "treatmentCycleId" = session."treatmentCycleId"
            FROM clinical_session session
            WHERE assessment."treatmentCycleId" IS NULL
                AND assessment."clinicalSessionId" = session.id
                AND session."treatmentCycleId" IS NOT NULL;
        `);
        await queryRunner.query(`
            UPDATE assessment assessment
            SET "treatmentCycleId" = cycle.id
            FROM treatment_cycle cycle
            WHERE assessment."treatmentCycleId" IS NULL
                AND assessment."patientId" = cycle."patientId"
                AND cycle."cycleKind" = 'CLINICAL'
                AND cycle.status = 'ACTIVE';
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_clinical_session_treatment_cycle'
                ) THEN
                    ALTER TABLE clinical_session
                        ADD CONSTRAINT "FK_clinical_session_treatment_cycle"
                        FOREIGN KEY ("treatmentCycleId")
                        REFERENCES treatment_cycle(id)
                        ON DELETE SET NULL;
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_assessment_treatment_cycle'
                ) THEN
                    ALTER TABLE assessment
                        ADD CONSTRAINT "FK_assessment_treatment_cycle"
                        FOREIGN KEY ("treatmentCycleId")
                        REFERENCES treatment_cycle(id)
                        ON DELETE SET NULL;
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_treatment_cycle_last_clinical_session'
                ) THEN
                    ALTER TABLE treatment_cycle
                        ADD CONSTRAINT "FK_treatment_cycle_last_clinical_session"
                        FOREIGN KEY ("lastClinicalSessionId")
                        REFERENCES clinical_session(id)
                        ON DELETE SET NULL;
                END IF;
            END
            $$;
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_clinical_session_treatment_cycle"
                ON clinical_session ("treatmentCycleId");
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_assessment_treatment_cycle"
                ON assessment ("treatmentCycleId");
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE assessment
                DROP CONSTRAINT IF EXISTS "FK_assessment_treatment_cycle";
        `);
        await queryRunner.query(`
            ALTER TABLE clinical_session
                DROP CONSTRAINT IF EXISTS "FK_clinical_session_treatment_cycle";
        `);
        await queryRunner.query(`
            ALTER TABLE treatment_cycle
                DROP CONSTRAINT IF EXISTS "FK_treatment_cycle_last_clinical_session";
        `);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_assessment_treatment_cycle";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_clinical_session_treatment_cycle";`);
        await queryRunner.query(`ALTER TABLE assessment DROP COLUMN IF EXISTS "treatmentCycleId";`);
        await queryRunner.query(`ALTER TABLE clinical_session DROP COLUMN IF EXISTS "treatmentCycleId";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_treatment_cycle_active_therapist";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_treatment_cycle_active_patient";`);
        await queryRunner.query(`DROP TABLE IF EXISTS treatment_cycle;`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_case_event_reason_unique_sibling";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_case_event_reason_department";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_case_event_reason_context_parent";`);
        await queryRunner.query(`DROP TABLE IF EXISTS case_event_reason;`);
        await queryRunner.query(`DROP TYPE IF EXISTS "case_event_reason_context_enum";`);
        await queryRunner.query(`DROP TYPE IF EXISTS "treatment_cycle_status_enum";`);
        await queryRunner.query(`DROP TYPE IF EXISTS "treatment_cycle_kind_enum";`);
    }

    private async seedReasonTree(
        queryRunner: QueryRunner,
        context: string,
        rows: Array<[string, string | null, number]>,
    ): Promise<void> {
        for (const [label, parentLabel, sortOrder] of rows) {
            await queryRunner.query(
                `
                WITH parent AS (
                    SELECT id
                    FROM case_event_reason
                    WHERE context = $1::case_event_reason_context_enum
                        AND label = $2::varchar
                        AND "departmentId" IS NULL
                    ORDER BY id ASC
                    LIMIT 1
                )
                INSERT INTO case_event_reason (
                    context,
                    label,
                    "parentId",
                    "departmentId",
                    active,
                    "sortOrder"
                )
                SELECT
                    $1::case_event_reason_context_enum,
                    $3::varchar,
                    ${parentLabel ? '(SELECT id FROM parent)' : 'NULL'},
                    NULL,
                    true,
                    $4
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM case_event_reason existing
                    WHERE existing.context = $1::case_event_reason_context_enum
                        AND existing.label = $3::varchar
                        AND existing."departmentId" IS NULL
                        AND (
                            ${parentLabel ? 'existing."parentId" = (SELECT id FROM parent)' : 'existing."parentId" IS NULL'}
                        )
                );
                `,
                [context, parentLabel, label, sortOrder],
            );
        }
    }
}
