import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClinicalSessionSchemeApplications1779000001018 implements MigrationInterface {
    name = 'ClinicalSessionSchemeApplications1779000001018';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_type WHERE typname = 'clinical_session_scheme_application_mode_enum'
                ) THEN
                    CREATE TYPE "clinical_session_scheme_application_mode_enum"
                        AS ENUM ('RELATIVE_FROM_SESSION', 'ORIGINAL_SESSION_NUMBER');
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM pg_type WHERE typname = 'clinical_session_scheme_application_status_enum'
                ) THEN
                    CREATE TYPE "clinical_session_scheme_application_status_enum"
                        AS ENUM ('ACTIVE', 'STOPPED', 'REPLACED');
                END IF;
            END
            $$;
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS clinical_session_scheme_application (
                id serial CONSTRAINT "PK_clinical_session_scheme_application" PRIMARY KEY,
                "schemeId" integer NOT NULL
                    CONSTRAINT "FK_clinical_session_scheme_application_scheme"
                    REFERENCES evaluation_scheme(id),
                "sessionKind" clinical_session_kind_enum NOT NULL,
                "patientId" integer NULL
                    CONSTRAINT "FK_clinical_session_scheme_application_patient"
                    REFERENCES patient(id),
                "therapistId" integer NULL
                    CONSTRAINT "FK_clinical_session_scheme_application_therapist"
                    REFERENCES "user"(id),
                "startClinicalSessionId" integer NOT NULL
                    CONSTRAINT "FK_clinical_session_scheme_application_start_session"
                    REFERENCES clinical_session(id),
                "startSessionNumber" integer NULL,
                "applicationMode" "clinical_session_scheme_application_mode_enum" NOT NULL,
                status "clinical_session_scheme_application_status_enum" NOT NULL DEFAULT 'ACTIVE',
                "stoppedAtClinicalSessionId" integer NULL
                    CONSTRAINT "FK_clinical_session_scheme_application_stopped_session"
                    REFERENCES clinical_session(id),
                "createdByUserId" integer NULL
                    CONSTRAINT "FK_clinical_session_scheme_application_created_by"
                    REFERENCES "user"(id),
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
            );
        `);

        await queryRunner.query(`
            ALTER TABLE clinical_session_resource
                ADD COLUMN IF NOT EXISTS "schemeApplicationId" integer NULL;
        `);
        await queryRunner.query(`
            ALTER TABLE assessment
                ADD COLUMN IF NOT EXISTS "schemeApplicationId" integer NULL;
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'FK_clinical_session_resource_scheme_application'
                ) THEN
                    ALTER TABLE clinical_session_resource
                        ADD CONSTRAINT "FK_clinical_session_resource_scheme_application"
                        FOREIGN KEY ("schemeApplicationId")
                        REFERENCES clinical_session_scheme_application(id);
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'FK_assessment_scheme_application'
                ) THEN
                    ALTER TABLE assessment
                        ADD CONSTRAINT "FK_assessment_scheme_application"
                        FOREIGN KEY ("schemeApplicationId")
                        REFERENCES clinical_session_scheme_application(id);
                END IF;
            END
            $$;
        `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_clinical_session_scheme_application_context" ON clinical_session_scheme_application ("schemeId", "sessionKind", "patientId", "therapistId", status);`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_clinical_session_resource_scheme_application" ON clinical_session_resource ("schemeApplicationId");`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_assessment_scheme_application" ON assessment ("schemeApplicationId");`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_assessment_scheme_application";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_clinical_session_resource_scheme_application";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_clinical_session_scheme_application_context";`);
        await queryRunner.query(`ALTER TABLE assessment DROP CONSTRAINT IF EXISTS "FK_assessment_scheme_application";`);
        await queryRunner.query(`ALTER TABLE clinical_session_resource DROP CONSTRAINT IF EXISTS "FK_clinical_session_resource_scheme_application";`);
        await queryRunner.query(`ALTER TABLE assessment DROP COLUMN IF EXISTS "schemeApplicationId";`);
        await queryRunner.query(`ALTER TABLE clinical_session_resource DROP COLUMN IF EXISTS "schemeApplicationId";`);
        await queryRunner.query(`DROP TABLE IF EXISTS clinical_session_scheme_application;`);
        await queryRunner.query(`DROP TYPE IF EXISTS "clinical_session_scheme_application_status_enum";`);
        await queryRunner.query(`DROP TYPE IF EXISTS "clinical_session_scheme_application_mode_enum";`);
    }
}
