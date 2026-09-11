import { MigrationInterface, QueryRunner } from 'typeorm';

export class ResponsibleUsers1779000001015 implements MigrationInterface {
    name = 'ResponsibleUsers1779000001015';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS clinical_session_responsible_user (
                "clinicalSessionId" integer NOT NULL
                    CONSTRAINT "FK_clinical_session_responsible_session"
                    REFERENCES clinical_session(id) ON DELETE CASCADE,
                "userId" integer NOT NULL
                    CONSTRAINT "FK_clinical_session_responsible_user"
                    REFERENCES "user"(id) ON DELETE CASCADE,
                CONSTRAINT "PK_clinical_session_responsible_user"
                    PRIMARY KEY ("clinicalSessionId", "userId")
            );
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS calendar_occurrence_responsible_user (
                "calendarOccurrenceId" integer NOT NULL
                    CONSTRAINT "FK_calendar_occurrence_responsible_occurrence"
                    REFERENCES calendar_occurrence(id) ON DELETE CASCADE,
                "userId" integer NOT NULL
                    CONSTRAINT "FK_calendar_occurrence_responsible_user"
                    REFERENCES "user"(id) ON DELETE CASCADE,
                CONSTRAINT "PK_calendar_occurrence_responsible_user"
                    PRIMARY KEY ("calendarOccurrenceId", "userId")
            );
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS assessment_responsible_user (
                "assessmentId" integer NOT NULL
                    CONSTRAINT "FK_assessment_responsible_assessment"
                    REFERENCES assessment(id) ON DELETE CASCADE,
                "userId" integer NOT NULL
                    CONSTRAINT "FK_assessment_responsible_user"
                    REFERENCES "user"(id) ON DELETE CASCADE,
                CONSTRAINT "PK_assessment_responsible_user"
                    PRIMARY KEY ("assessmentId", "userId")
            );
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_clinical_session_responsible_user_user"
                ON clinical_session_responsible_user ("userId");
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_calendar_occurrence_responsible_user_user"
                ON calendar_occurrence_responsible_user ("userId");
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_assessment_responsible_user_user"
                ON assessment_responsible_user ("userId");
        `);

        await queryRunner.query(`
            INSERT INTO clinical_session_responsible_user ("clinicalSessionId", "userId")
            SELECT id, "therapistId"
            FROM clinical_session
            WHERE "therapistId" IS NOT NULL
            ON CONFLICT DO NOTHING;
        `);
        await queryRunner.query(`
            INSERT INTO clinical_session_responsible_user ("clinicalSessionId", "userId")
            SELECT id, "supervisorId"
            FROM clinical_session
            WHERE "supervisorId" IS NOT NULL
            ON CONFLICT DO NOTHING;
        `);
        await queryRunner.query(`
            INSERT INTO calendar_occurrence_responsible_user ("calendarOccurrenceId", "userId")
            SELECT id, "therapistId"
            FROM calendar_occurrence
            WHERE "therapistId" IS NOT NULL
            ON CONFLICT DO NOTHING;
        `);
        await queryRunner.query(`
            INSERT INTO calendar_occurrence_responsible_user ("calendarOccurrenceId", "userId")
            SELECT id, "supervisorId"
            FROM calendar_occurrence
            WHERE "supervisorId" IS NOT NULL
            ON CONFLICT DO NOTHING;
        `);
        await queryRunner.query(`
            INSERT INTO assessment_responsible_user ("assessmentId", "userId")
            SELECT id, "clinicianId"
            FROM assessment
            WHERE "clinicianId" IS NOT NULL
            ON CONFLICT DO NOTHING;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS assessment_responsible_user;`);
        await queryRunner.query(`DROP TABLE IF EXISTS calendar_occurrence_responsible_user;`);
        await queryRunner.query(`DROP TABLE IF EXISTS clinical_session_responsible_user;`);
    }
}
