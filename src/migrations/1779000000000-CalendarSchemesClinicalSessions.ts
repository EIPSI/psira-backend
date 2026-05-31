import { MigrationInterface, QueryRunner } from 'typeorm';

export class CalendarSchemesClinicalSessions1779000000000
    implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "evaluation_scheme_schemeType_enum" AS ENUM ('SESSION_BASED', 'INDEPENDENT_EVALUATION');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "evaluation_scheme_assignment_status_enum" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "clinical_session_kind_enum" AS ENUM ('CLINICAL', 'SUPERVISION');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "clinical_session_status_enum" AS ENUM ('SCHEDULED', 'OPEN', 'COMPLETED', 'CANCELLED');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "clinical_session_resource_kind_enum" AS ENUM ('PRE_ASSESSMENT', 'POST_ASSESSMENT', 'CLINICAL_NOTES', 'FOLLOW_UP');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "clinical_session_resource_status_enum" AS ENUM ('PENDING', 'OPEN', 'COMPLETED', 'DETACHED', 'CANCELLED');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "resource_activation_anchor_enum" AS ENUM ('SESSION_START', 'SESSION_END');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "calendar_occurrence_type_enum" AS ENUM ('CLINICAL_SESSION', 'INDEPENDENT_ASSESSMENT', 'SUPERVISION');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "calendar_occurrence_status_enum" AS ENUM ('SCHEDULED', 'OPEN', 'COMPLETED', 'CANCELLED', 'DETACHED');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS evaluation_scheme (
                id serial CONSTRAINT "PK_evaluation_scheme" PRIMARY KEY,
                name varchar NOT NULL,
                description varchar,
                "schemeType" "evaluation_scheme_schemeType_enum" NOT NULL,
                "defaultRecurrenceRule" varchar,
                "defaultDurationMinutes" integer DEFAULT 60 NOT NULL,
                active boolean DEFAULT true NOT NULL,
                "createdAt" timestamp DEFAULT now() NOT NULL,
                "updatedAt" timestamp DEFAULT now() NOT NULL
            );
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS evaluation_scheme_department (
                "evaluationSchemeId" integer NOT NULL
                    CONSTRAINT "FK_evaluation_scheme_department_scheme"
                    REFERENCES evaluation_scheme(id) ON DELETE CASCADE,
                "departmentId" integer NOT NULL
                    CONSTRAINT "FK_evaluation_scheme_department_department"
                    REFERENCES department(id) ON DELETE CASCADE,
                CONSTRAINT "PK_evaluation_scheme_department"
                    PRIMARY KEY ("evaluationSchemeId", "departmentId")
            );
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS evaluation_scheme_assignment (
                id serial CONSTRAINT "PK_evaluation_scheme_assignment" PRIMARY KEY,
                "schemeId" integer NOT NULL
                    CONSTRAINT "FK_evaluation_scheme_assignment_scheme"
                    REFERENCES evaluation_scheme(id),
                "patientId" integer
                    CONSTRAINT "FK_evaluation_scheme_assignment_patient"
                    REFERENCES patient(id),
                "targetUserId" integer
                    CONSTRAINT "FK_evaluation_scheme_assignment_target_user"
                    REFERENCES "user"(id),
                "therapistId" integer
                    CONSTRAINT "FK_evaluation_scheme_assignment_therapist"
                    REFERENCES "user"(id),
                "supervisorId" integer
                    CONSTRAINT "FK_evaluation_scheme_assignment_supervisor"
                    REFERENCES "user"(id),
                "responderUserId" integer
                    CONSTRAINT "FK_evaluation_scheme_assignment_responder"
                    REFERENCES "user"(id),
                "clinicianId" integer
                    CONSTRAINT "FK_evaluation_scheme_assignment_clinician"
                    REFERENCES "user"(id),
                "startDate" timestamp NOT NULL,
                timezone varchar DEFAULT 'UTC' NOT NULL,
                status "evaluation_scheme_assignment_status_enum" DEFAULT 'ACTIVE' NOT NULL,
                "maxFutureOccurrences" integer DEFAULT 12 NOT NULL,
                "futureGenerationMonths" integer DEFAULT 3 NOT NULL,
                "createdAt" timestamp DEFAULT now() NOT NULL,
                "updatedAt" timestamp DEFAULT now() NOT NULL
            );
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS scheme_session_template (
                id serial CONSTRAINT "PK_scheme_session_template" PRIMARY KEY,
                "schemeId" integer NOT NULL
                    CONSTRAINT "FK_scheme_session_template_scheme"
                    REFERENCES evaluation_scheme(id),
                "sessionKind" "clinical_session_kind_enum" NOT NULL,
                "sessionIndex" integer NOT NULL,
                title varchar NOT NULL,
                "relativeOffsetDays" integer DEFAULT 0 NOT NULL,
                "durationMinutes" integer DEFAULT 60 NOT NULL,
                "createdAt" timestamp DEFAULT now() NOT NULL,
                "updatedAt" timestamp DEFAULT now() NOT NULL
            );
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS scheme_resource_template (
                id serial CONSTRAINT "PK_scheme_resource_template" PRIMARY KEY,
                "sessionTemplateId" integer NOT NULL
                    CONSTRAINT "FK_scheme_resource_template_session_template"
                    REFERENCES scheme_session_template(id),
                "resourceKind" "clinical_session_resource_kind_enum" NOT NULL,
                "assessmentTypeId" integer
                    CONSTRAINT "FK_scheme_resource_template_assessment_type"
                    REFERENCES assessment_type(id),
                "questionnaireIds" text,
                "questionnaireBundleIds" text,
                "informantType" varchar DEFAULT 'PATIENT',
                "defaultResponderRole" varchar,
                "activationAnchor" "resource_activation_anchor_enum",
                "activationOffsetMinutes" integer,
                "availabilityDurationMinutes" integer,
                "createdAt" timestamp DEFAULT now() NOT NULL,
                "updatedAt" timestamp DEFAULT now() NOT NULL
            );
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS independent_evaluation_template (
                id serial CONSTRAINT "PK_independent_evaluation_template" PRIMARY KEY,
                "schemeId" integer NOT NULL
                    CONSTRAINT "FK_independent_evaluation_template_scheme"
                    REFERENCES evaluation_scheme(id),
                "assessmentTypeId" integer NOT NULL
                    CONSTRAINT "FK_independent_evaluation_template_assessment_type"
                    REFERENCES assessment_type(id),
                "questionnaireIds" text,
                "questionnaireBundleIds" text,
                "informantType" varchar DEFAULT 'PATIENT',
                "defaultResponderRole" varchar,
                "createdAt" timestamp DEFAULT now() NOT NULL,
                "updatedAt" timestamp DEFAULT now() NOT NULL
            );
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS calendar_occurrence (
                id serial CONSTRAINT "PK_calendar_occurrence" PRIMARY KEY,
                "occurrenceType" "calendar_occurrence_type_enum" NOT NULL,
                title varchar NOT NULL,
                "startAt" timestamp NOT NULL,
                "endAt" timestamp NOT NULL,
                timezone varchar DEFAULT 'UTC' NOT NULL,
                status "calendar_occurrence_status_enum" DEFAULT 'SCHEDULED' NOT NULL,
                "schemeId" integer
                    CONSTRAINT "FK_calendar_occurrence_scheme"
                    REFERENCES evaluation_scheme(id),
                "schemeAssignmentId" integer
                    CONSTRAINT "FK_calendar_occurrence_scheme_assignment"
                    REFERENCES evaluation_scheme_assignment(id),
                "patientId" integer
                    CONSTRAINT "FK_calendar_occurrence_patient"
                    REFERENCES patient(id),
                "therapistId" integer
                    CONSTRAINT "FK_calendar_occurrence_therapist"
                    REFERENCES "user"(id),
                "supervisorId" integer
                    CONSTRAINT "FK_calendar_occurrence_supervisor"
                    REFERENCES "user"(id),
                "isDetachedFromTemplate" boolean DEFAULT false NOT NULL,
                "templateVersion" integer,
                "originalStartAt" timestamp,
                "cancellationReason" varchar,
                notes varchar,
                "createdAt" timestamp DEFAULT now() NOT NULL,
                "updatedAt" timestamp DEFAULT now() NOT NULL
            );
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS clinical_session (
                id serial CONSTRAINT "PK_clinical_session" PRIMARY KEY,
                "calendarOccurrenceId" integer NOT NULL
                    CONSTRAINT "UQ_clinical_session_calendar_occurrence"
                    UNIQUE
                    CONSTRAINT "FK_clinical_session_calendar_occurrence"
                    REFERENCES calendar_occurrence(id),
                "sessionTemplateId" integer
                    CONSTRAINT "FK_clinical_session_session_template"
                    REFERENCES scheme_session_template(id),
                "sessionKind" "clinical_session_kind_enum" NOT NULL,
                "sessionNumber" integer,
                "patientId" integer
                    CONSTRAINT "FK_clinical_session_patient"
                    REFERENCES patient(id),
                "therapistId" integer
                    CONSTRAINT "FK_clinical_session_therapist"
                    REFERENCES "user"(id),
                "supervisorId" integer
                    CONSTRAINT "FK_clinical_session_supervisor"
                    REFERENCES "user"(id),
                "clinicalStatus" "clinical_session_status_enum" DEFAULT 'SCHEDULED' NOT NULL,
                "createdAt" timestamp DEFAULT now() NOT NULL,
                "updatedAt" timestamp DEFAULT now() NOT NULL
            );
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS clinical_session_resource (
                id serial CONSTRAINT "PK_clinical_session_resource" PRIMARY KEY,
                "clinicalSessionId" integer NOT NULL
                    CONSTRAINT "FK_clinical_session_resource_clinical_session"
                    REFERENCES clinical_session(id),
                "resourceTemplateId" integer
                    CONSTRAINT "FK_clinical_session_resource_resource_template"
                    REFERENCES scheme_resource_template(id),
                "assessmentId" integer
                    CONSTRAINT "UQ_clinical_session_resource_assessment"
                    UNIQUE,
                "resourceKind" "clinical_session_resource_kind_enum" NOT NULL,
                status "clinical_session_resource_status_enum" DEFAULT 'PENDING' NOT NULL,
                "activationAnchor" "resource_activation_anchor_enum",
                "activationOffsetMinutes" integer,
                "availabilityDurationMinutes" integer,
                "activationAt" timestamp,
                "expirationAt" timestamp,
                "detachedAt" timestamp,
                "detachedReason" varchar,
                "replacementResourceId" integer,
                "replacedResourceId" integer,
                "createdAt" timestamp DEFAULT now() NOT NULL,
                "updatedAt" timestamp DEFAULT now() NOT NULL
            );
        `);

        await queryRunner.query(`
            ALTER TABLE assessment
                ADD COLUMN IF NOT EXISTS "calendarOccurrenceId" integer,
                ADD COLUMN IF NOT EXISTS "clinicalSessionId" integer,
                ADD COLUMN IF NOT EXISTS "clinicalSessionResourceId" integer,
                ADD COLUMN IF NOT EXISTS "schemeId" integer,
                ADD COLUMN IF NOT EXISTS "schemeAssignmentId" integer,
                ADD COLUMN IF NOT EXISTS "schemeResourceTemplateId" integer,
                ADD COLUMN IF NOT EXISTS "detachedFromSessionAt" timestamp,
                ADD COLUMN IF NOT EXISTS "detachedFromSessionReason" varchar;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE assessment
                    ADD CONSTRAINT "FK_assessment_calendar_occurrence"
                    FOREIGN KEY ("calendarOccurrenceId") REFERENCES calendar_occurrence(id);
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE assessment
                    ADD CONSTRAINT "FK_assessment_clinical_session"
                    FOREIGN KEY ("clinicalSessionId") REFERENCES clinical_session(id);
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE assessment
                    ADD CONSTRAINT "FK_assessment_clinical_session_resource"
                    FOREIGN KEY ("clinicalSessionResourceId") REFERENCES clinical_session_resource(id);
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE assessment
                    ADD CONSTRAINT "FK_assessment_scheme"
                    FOREIGN KEY ("schemeId") REFERENCES evaluation_scheme(id);
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE assessment
                    ADD CONSTRAINT "FK_assessment_scheme_assignment"
                    FOREIGN KEY ("schemeAssignmentId") REFERENCES evaluation_scheme_assignment(id);
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE assessment
                    ADD CONSTRAINT "FK_assessment_scheme_resource_template"
                    FOREIGN KEY ("schemeResourceTemplateId") REFERENCES scheme_resource_template(id);
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE clinical_session_resource
                    ADD CONSTRAINT "FK_clinical_session_resource_assessment"
                    FOREIGN KEY ("assessmentId") REFERENCES assessment(id);
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_calendar_occurrence_start_end" ON calendar_occurrence ("startAt", "endAt");`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_calendar_occurrence_patient" ON calendar_occurrence ("patientId");`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_calendar_occurrence_therapist" ON calendar_occurrence ("therapistId");`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_calendar_occurrence_supervisor" ON calendar_occurrence ("supervisorId");`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_clinical_session_occurrence" ON clinical_session ("calendarOccurrenceId");`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_clinical_session_resource_session" ON clinical_session_resource ("clinicalSessionId");`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_assessment_calendar_occurrence" ON assessment ("calendarOccurrenceId");`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_assessment_clinical_session" ON assessment ("clinicalSessionId");`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE assessment
                DROP CONSTRAINT IF EXISTS "FK_assessment_scheme_resource_template",
                DROP CONSTRAINT IF EXISTS "FK_assessment_scheme_assignment",
                DROP CONSTRAINT IF EXISTS "FK_assessment_scheme",
                DROP CONSTRAINT IF EXISTS "FK_assessment_clinical_session_resource",
                DROP CONSTRAINT IF EXISTS "FK_assessment_clinical_session",
                DROP CONSTRAINT IF EXISTS "FK_assessment_calendar_occurrence";
        `);

        await queryRunner.query(`
            ALTER TABLE clinical_session_resource
                DROP CONSTRAINT IF EXISTS "FK_clinical_session_resource_assessment";
        `);

        await queryRunner.query(`
            ALTER TABLE assessment
                DROP COLUMN IF EXISTS "detachedFromSessionReason",
                DROP COLUMN IF EXISTS "detachedFromSessionAt",
                DROP COLUMN IF EXISTS "schemeResourceTemplateId",
                DROP COLUMN IF EXISTS "schemeAssignmentId",
                DROP COLUMN IF EXISTS "schemeId",
                DROP COLUMN IF EXISTS "clinicalSessionResourceId",
                DROP COLUMN IF EXISTS "clinicalSessionId",
                DROP COLUMN IF EXISTS "calendarOccurrenceId";
        `);

        await queryRunner.query(`DROP TABLE IF EXISTS clinical_session_resource;`);
        await queryRunner.query(`DROP TABLE IF EXISTS clinical_session;`);
        await queryRunner.query(`DROP TABLE IF EXISTS calendar_occurrence;`);
        await queryRunner.query(`DROP TABLE IF EXISTS independent_evaluation_template;`);
        await queryRunner.query(`DROP TABLE IF EXISTS scheme_resource_template;`);
        await queryRunner.query(`DROP TABLE IF EXISTS scheme_session_template;`);
        await queryRunner.query(`DROP TABLE IF EXISTS evaluation_scheme_assignment;`);
        await queryRunner.query(`DROP TABLE IF EXISTS evaluation_scheme_department;`);
        await queryRunner.query(`DROP TABLE IF EXISTS evaluation_scheme;`);

        await queryRunner.query(`DROP TYPE IF EXISTS "calendar_occurrence_status_enum";`);
        await queryRunner.query(`DROP TYPE IF EXISTS "calendar_occurrence_type_enum";`);
        await queryRunner.query(`DROP TYPE IF EXISTS "resource_activation_anchor_enum";`);
        await queryRunner.query(`DROP TYPE IF EXISTS "clinical_session_resource_status_enum";`);
        await queryRunner.query(`DROP TYPE IF EXISTS "clinical_session_resource_kind_enum";`);
        await queryRunner.query(`DROP TYPE IF EXISTS "clinical_session_status_enum";`);
        await queryRunner.query(`DROP TYPE IF EXISTS "clinical_session_kind_enum";`);
        await queryRunner.query(`DROP TYPE IF EXISTS "evaluation_scheme_assignment_status_enum";`);
        await queryRunner.query(`DROP TYPE IF EXISTS "evaluation_scheme_schemeType_enum";`);
    }
}
