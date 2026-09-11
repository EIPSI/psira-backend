import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationConfiguration1787600000000 implements MigrationInterface {
    name = 'NotificationConfiguration1787600000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "notification_configuration_channel_enum" AS ENUM ('EMAIL');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "notification_configuration_family_enum" AS ENUM ('ASSESSMENT', 'CASE', 'AUTOMATION');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "notification_configuration_event_enum" AS ENUM ('ASSESSMENT_ASSIGNED', 'ASSESSMENT_ANSWERED', 'ASSESSMENT_NOT_ANSWERED', 'ASSESSMENT_PERIODIC_SUMMARY', 'CASE_UPDATED');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "notification_log_status_enum" AS ENUM ('SENT', 'FAILED', 'SKIPPED_NO_CONFIGURATION', 'SKIPPED_DISABLED', 'SKIPPED_RECIPIENT_OPTED_OUT');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "notification_log_channel_enum" AS ENUM ('EMAIL');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "notification_log_event_enum" AS ENUM ('ASSESSMENT_ASSIGNED', 'ASSESSMENT_ANSWERED', 'ASSESSMENT_NOT_ANSWERED', 'ASSESSMENT_PERIODIC_SUMMARY', 'CASE_UPDATED');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "notification_preference_periodicUnit_enum" AS ENUM ('DAYS', 'WEEKS', 'MONTHS');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "notification_configuration" (
                "id" SERIAL NOT NULL,
                "departmentId" integer,
                "channel" "notification_configuration_channel_enum" NOT NULL,
                "family" "notification_configuration_family_enum" NOT NULL,
                "event" "notification_configuration_event_enum" NOT NULL,
                "recipientRoleId" integer NOT NULL,
                "mailTemplateId" integer,
                "active" boolean NOT NULL DEFAULT true,
                "notes" character varying,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_notification_configuration" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "UQ_notification_configuration_scope_default"
            ON "notification_configuration" ("channel", "event", "recipientRoleId")
            WHERE "departmentId" IS NULL
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "UQ_notification_configuration_scope_department"
            ON "notification_configuration" ("departmentId", "channel", "event", "recipientRoleId")
            WHERE "departmentId" IS NOT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE "notification_configuration"
            ADD CONSTRAINT "FK_notification_configuration_department"
            FOREIGN KEY ("departmentId") REFERENCES "department"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "notification_configuration"
            ADD CONSTRAINT "FK_notification_configuration_recipient_role"
            FOREIGN KEY ("recipientRoleId") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "notification_configuration"
            ADD CONSTRAINT "FK_notification_configuration_mail_template"
            FOREIGN KEY ("mailTemplateId") REFERENCES "mail_template"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "notification_log" (
                "id" SERIAL NOT NULL,
                "channel" "notification_log_channel_enum" NOT NULL,
                "event" "notification_log_event_enum" NOT NULL,
                "status" "notification_log_status_enum" NOT NULL,
                "notificationConfigurationId" integer,
                "recipientId" integer,
                "recipientEmail" character varying,
                "mailTemplateId" integer,
                "assessmentId" integer,
                "patientId" integer,
                "therapistId" integer,
                "subject" character varying,
                "message" character varying,
                "metadata" text,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_notification_log" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            ALTER TABLE "notification_log"
            ADD CONSTRAINT "FK_notification_log_recipient"
            FOREIGN KEY ("recipientId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "notification_log"
            ADD CONSTRAINT "FK_notification_log_mail_template"
            FOREIGN KEY ("mailTemplateId") REFERENCES "mail_template"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "notification_preference" (
                "id" SERIAL NOT NULL,
                "patientId" integer,
                "therapistId" integer,
                "enabled" boolean NOT NULL DEFAULT true,
                "immediateEnabled" boolean NOT NULL DEFAULT true,
                "periodicEnabled" boolean NOT NULL DEFAULT false,
                "periodicEvery" integer NOT NULL DEFAULT 1,
                "periodicUnit" "notification_preference_periodicUnit_enum" NOT NULL DEFAULT 'WEEKS',
                "enabledEvents" text,
                "excludedRecipientIds" text,
                "lastPeriodicSentAt" TIMESTAMP,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_notification_preference" PRIMARY KEY ("id"),
                CONSTRAINT "CHK_notification_preference_scope" CHECK (
                    ("patientId" IS NOT NULL AND "therapistId" IS NULL)
                    OR ("patientId" IS NULL AND "therapistId" IS NOT NULL)
                )
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "UQ_notification_preference_patient"
            ON "notification_preference" ("patientId")
            WHERE "patientId" IS NOT NULL
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "UQ_notification_preference_therapist"
            ON "notification_preference" ("therapistId")
            WHERE "therapistId" IS NOT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE "notification_preference"
            ADD CONSTRAINT "FK_notification_preference_patient"
            FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "notification_preference"
            ADD CONSTRAINT "FK_notification_preference_therapist"
            FOREIGN KEY ("therapistId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "notification_preference"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "notification_log"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "notification_configuration"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "notification_preference_periodicUnit_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "notification_log_event_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "notification_log_channel_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "notification_log_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "notification_configuration_event_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "notification_configuration_family_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "notification_configuration_channel_enum"`);
    }
}
