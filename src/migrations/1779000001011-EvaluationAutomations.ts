import { MigrationInterface, QueryRunner } from 'typeorm';

export class EvaluationAutomations1779000001011 implements MigrationInterface {
    name = 'EvaluationAutomations1779000001011';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "evaluation_automation_triggerPoint_enum" AS ENUM ('user_created', 'first_login');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "evaluation_automation_automationType_enum" AS ENUM ('FIXED_SCHEME', 'INDIVIDUAL_EVALUATION');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "evaluation_automation_delayUnit_enum" AS ENUM ('DAYS', 'MINUTES');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "evaluation_automation_run_triggerPoint_enum" AS ENUM ('user_created', 'first_login');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "evaluation_automation_run_status_enum" AS ENUM ('pending', 'executed', 'failed', 'skipped', 'cancelled');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "evaluation_automation_run_reason_enum" AS ENUM (
                    'conditions_not_met',
                    'duplicate_detected',
                    'automation_inactive',
                    'missing_required_data',
                    'invalid_role',
                    'invalid_department',
                    'resource_not_found',
                    'execution_error'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "evaluation_automation_run_resourceType_enum" AS ENUM ('EVALUATION_SCHEME_ASSIGNMENT', 'ASSESSMENT');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS evaluation_automation (
                id serial CONSTRAINT "PK_evaluation_automation" PRIMARY KEY,
                title varchar NOT NULL,
                description varchar,
                active boolean DEFAULT true NOT NULL,
                "roleId" integer NOT NULL
                    CONSTRAINT "FK_evaluation_automation_role"
                    REFERENCES role(id),
                conditions text,
                "triggerPoint" "evaluation_automation_triggerPoint_enum" NOT NULL,
                "automationType" "evaluation_automation_automationType_enum" NOT NULL,
                "delayAmount" integer NOT NULL,
                "delayUnit" "evaluation_automation_delayUnit_enum" NOT NULL,
                priority integer DEFAULT 100 NOT NULL,
                "schemeId" integer
                    CONSTRAINT "FK_evaluation_automation_scheme"
                    REFERENCES evaluation_scheme(id),
                "assessmentTypeId" integer
                    CONSTRAINT "FK_evaluation_automation_assessment_type"
                    REFERENCES assessment_type(id),
                "questionnaireIds" text,
                "questionnaireBundleIds" text,
                "randomizationRuleIds" text,
                "evaluationName" varchar,
                "expirationMinutes" integer,
                "reminderMinutes" text,
                "emailNotificationsEnabled" boolean DEFAULT true NOT NULL,
                "mailTemplateId" integer
                    CONSTRAINT "FK_evaluation_automation_mail_template"
                    REFERENCES mail_template(id),
                "createdAt" timestamp DEFAULT now() NOT NULL,
                "updatedAt" timestamp DEFAULT now() NOT NULL
            );
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS evaluation_automation_department (
                "automationId" integer NOT NULL
                    CONSTRAINT "FK_evaluation_automation_department_automation"
                    REFERENCES evaluation_automation(id) ON DELETE CASCADE,
                "departmentId" integer NOT NULL
                    CONSTRAINT "FK_evaluation_automation_department_department"
                    REFERENCES department(id) ON DELETE CASCADE,
                CONSTRAINT "PK_evaluation_automation_department"
                    PRIMARY KEY ("automationId", "departmentId")
            );
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS evaluation_automation_run (
                id serial CONSTRAINT "PK_evaluation_automation_run" PRIMARY KEY,
                "automationId" integer
                    CONSTRAINT "FK_evaluation_automation_run_automation"
                    REFERENCES evaluation_automation(id) ON DELETE SET NULL,
                "automationTitle" varchar,
                "userId" integer NOT NULL
                    CONSTRAINT "FK_evaluation_automation_run_user"
                    REFERENCES "user"(id),
                "triggerPoint" "evaluation_automation_run_triggerPoint_enum" NOT NULL,
                "triggerEventId" varchar NOT NULL,
                status "evaluation_automation_run_status_enum" DEFAULT 'pending' NOT NULL,
                reason "evaluation_automation_run_reason_enum",
                message varchar,
                "resourceType" "evaluation_automation_run_resourceType_enum",
                "resourceId" integer,
                metadata text,
                "createdAt" timestamp DEFAULT now() NOT NULL,
                "updatedAt" timestamp DEFAULT now() NOT NULL
            );
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_evaluation_automation_trigger_active_priority"
            ON evaluation_automation ("triggerPoint", active, priority);
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_evaluation_automation_department_department"
            ON evaluation_automation_department ("departmentId");
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_evaluation_automation_run_unique_event"
            ON evaluation_automation_run ("automationId", "userId", "triggerPoint", "triggerEventId");
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_evaluation_automation_run_user"
            ON evaluation_automation_run ("userId");
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_evaluation_automation_run_user";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_evaluation_automation_run_unique_event";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_evaluation_automation_department_department";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_evaluation_automation_trigger_active_priority";`);
        await queryRunner.query(`DROP TABLE IF EXISTS evaluation_automation_run;`);
        await queryRunner.query(`DROP TABLE IF EXISTS evaluation_automation_department;`);
        await queryRunner.query(`DROP TABLE IF EXISTS evaluation_automation;`);
        await queryRunner.query(`DROP TYPE IF EXISTS "evaluation_automation_run_resourceType_enum";`);
        await queryRunner.query(`DROP TYPE IF EXISTS "evaluation_automation_run_reason_enum";`);
        await queryRunner.query(`DROP TYPE IF EXISTS "evaluation_automation_run_status_enum";`);
        await queryRunner.query(`DROP TYPE IF EXISTS "evaluation_automation_run_triggerPoint_enum";`);
        await queryRunner.query(`DROP TYPE IF EXISTS "evaluation_automation_delayUnit_enum";`);
        await queryRunner.query(`DROP TYPE IF EXISTS "evaluation_automation_automationType_enum";`);
        await queryRunner.query(`DROP TYPE IF EXISTS "evaluation_automation_triggerPoint_enum";`);
    }
}
