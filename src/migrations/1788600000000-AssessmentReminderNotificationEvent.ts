import { MigrationInterface, QueryRunner } from 'typeorm';

export class AssessmentReminderNotificationEvent1788600000000 implements MigrationInterface {
    name = 'AssessmentReminderNotificationEvent1788600000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            BEGIN
                ALTER TYPE "notification_configuration_event_enum" ADD VALUE IF NOT EXISTS 'ASSESSMENT_REMINDER';
            EXCEPTION WHEN undefined_object THEN
                NULL;
            END $$;
        `);
        await queryRunner.query(`
            DO $$
            BEGIN
                ALTER TYPE "notification_log_event_enum" ADD VALUE IF NOT EXISTS 'ASSESSMENT_REMINDER';
            EXCEPTION WHEN undefined_object THEN
                NULL;
            END $$;
        `);

        await queryRunner.query(`
            INSERT INTO "mail_template" ("name", "subject", "body", "status", "purpose", "isPublic", "createdAt", "updatedAt")
            SELECT
                'Recordatorio de evaluación',
                'Recordatorio: tenés una evaluación pendiente en PSIRA',
                '<p>Hola {{responder.firstName}},</p><p>Te recordamos que tenés una evaluación pendiente en PSIRA.</p><p>Evaluación: {{assessment.name}}</p><p><a href="{{assessment.link}}">Responder evaluación</a></p>',
                'ACTIVE',
                'NOTIFICATION',
                true,
                now(),
                now()
            WHERE NOT EXISTS (
                SELECT 1 FROM "mail_template" WHERE "name" = 'Recordatorio de evaluación'
            )
        `);

        await queryRunner.query(`
            UPDATE "notification_preference"
            SET "enabledEvents" = (
                SELECT jsonb_agg(DISTINCT event)::text
                FROM (
                    SELECT jsonb_array_elements_text("notification_preference"."enabledEvents"::jsonb) AS event
                    UNION
                    SELECT 'ASSESSMENT_REMINDER' AS event
                ) events
            )
            WHERE "enabledEvents" IS NOT NULL
              AND "enabledEvents" NOT LIKE '%ASSESSMENT_REMINDER%'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "mail_template" WHERE "name" = 'Recordatorio de evaluación'`);
    }
}
