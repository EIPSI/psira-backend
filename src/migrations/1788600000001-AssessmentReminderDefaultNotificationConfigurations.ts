import { MigrationInterface, QueryRunner } from 'typeorm';

export class AssessmentReminderDefaultNotificationConfigurations1788600000001 implements MigrationInterface {
    name = 'AssessmentReminderDefaultNotificationConfigurations1788600000001';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO "notification_configuration"
                ("departmentId", "channel", "family", "event", "recipientRoleId", "mailTemplateId", "active", "notes", "createdAt", "updatedAt")
            SELECT
                NULL,
                'EMAIL'::"notification_configuration_channel_enum",
                'ASSESSMENT'::"notification_configuration_family_enum",
                'ASSESSMENT_REMINDER'::"notification_configuration_event_enum",
                role.id,
                template.id,
                true,
                'Configuración por defecto: recordatorio al respondiente de una evaluación pendiente.',
                now(),
                now()
            FROM "role" role
            CROSS JOIN "mail_template" template
            WHERE role.code IN ('SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'SUPERVISOR', 'THERAPIST', 'CAREGIVER', 'PATIENT')
              AND template.name = 'Recordatorio de evaluación'
              AND template."deletedAt" IS NULL
              AND NOT EXISTS (
                  SELECT 1
                  FROM "notification_configuration" configuration
                  WHERE configuration."departmentId" IS NULL
                    AND configuration."channel" = 'EMAIL'::"notification_configuration_channel_enum"
                    AND configuration."event" = 'ASSESSMENT_REMINDER'::"notification_configuration_event_enum"
                    AND configuration."recipientRoleId" = role.id
              )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM "notification_configuration"
            WHERE "event" = 'ASSESSMENT_REMINDER'::"notification_configuration_event_enum"
              AND "notes" = 'Configuración por defecto: recordatorio al respondiente de una evaluación pendiente.'
        `);
    }
}
