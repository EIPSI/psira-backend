import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationPreferencesAndEvents1787700000000 implements MigrationInterface {
    name = 'NotificationPreferencesAndEvents1787700000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TYPE "notification_configuration_event_enum" ADD VALUE IF NOT EXISTS 'ASSESSMENT_PERIODIC_SUMMARY';
            EXCEPTION WHEN undefined_object THEN null;
            END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TYPE "notification_log_event_enum" ADD VALUE IF NOT EXISTS 'ASSESSMENT_PERIODIC_SUMMARY';
            EXCEPTION WHEN undefined_object THEN null;
            END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "notification_preference_periodicUnit_enum" AS ENUM ('DAYS', 'WEEKS', 'MONTHS');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryRunner.query(`
            ALTER TABLE "notification_log"
            ADD COLUMN IF NOT EXISTS "assessmentId" integer
        `);
        await queryRunner.query(`
            ALTER TABLE "notification_log"
            ADD COLUMN IF NOT EXISTS "patientId" integer
        `);
        await queryRunner.query(`
            ALTER TABLE "notification_log"
            ADD COLUMN IF NOT EXISTS "therapistId" integer
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
                CONSTRAINT "PK_notification_preference" PRIMARY KEY ("id")
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
            DO $$ BEGIN
                ALTER TABLE "notification_preference"
                ADD CONSTRAINT "CHK_notification_preference_scope" CHECK (
                    ("patientId" IS NOT NULL AND "therapistId" IS NULL)
                    OR ("patientId" IS NULL AND "therapistId" IS NOT NULL)
                );
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "notification_preference"
                ADD CONSTRAINT "FK_notification_preference_patient"
                FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "notification_preference"
                ADD CONSTRAINT "FK_notification_preference_therapist"
                FOREIGN KEY ("therapistId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "notification_preference"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "notification_preference_periodicUnit_enum"`);
        await queryRunner.query(`ALTER TABLE "notification_log" DROP COLUMN IF EXISTS "therapistId"`);
        await queryRunner.query(`ALTER TABLE "notification_log" DROP COLUMN IF EXISTS "patientId"`);
        await queryRunner.query(`ALTER TABLE "notification_log" DROP COLUMN IF EXISTS "assessmentId"`);
    }
}
