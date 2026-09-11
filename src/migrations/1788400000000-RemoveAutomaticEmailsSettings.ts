import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveAutomaticEmailsSettings1788400000000 implements MigrationInterface {
    name = 'RemoveAutomaticEmailsSettings1788400000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO "notification_configuration"
                ("departmentId", "channel", "family", "event", "recipientRoleId", "mailTemplateId", "active", "notes", "createdAt", "updatedAt")
            SELECT
                NULL,
                'EMAIL'::"notification_configuration_channel_enum",
                'AUTOMATION'::"notification_configuration_family_enum",
                'USER_CREATED'::"notification_configuration_event_enum",
                role.id,
                template.id,
                true,
                'Migrado desde Emails Automáticos: envío de credenciales al crear usuario.',
                now(),
                now()
            FROM "role" role
            CROSS JOIN "mail_template" template
            WHERE role.code IN ('SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'SUPERVISOR', 'THERAPIST', 'CAREGIVER', 'PATIENT')
              AND template.name = 'Creación de usuario'
              AND template."deletedAt" IS NULL
              AND NOT EXISTS (
                  SELECT 1
                  FROM "notification_configuration" configuration
                  WHERE configuration."departmentId" IS NULL
                    AND configuration."channel" = 'EMAIL'::"notification_configuration_channel_enum"
                    AND configuration."event" = 'USER_CREATED'::"notification_configuration_event_enum"
                    AND configuration."recipientRoleId" = role.id
              )
        `);

        await queryRunner.query(`
            UPDATE "mail_template"
            SET "deletedAt" = now(),
                "updatedAt" = now()
            WHERE "purpose" = 'WELCOME'
              AND "deletedAt" IS NULL
        `);

        await queryRunner.query(`
            DELETE FROM "setting"
            WHERE "key" IN ('sendWelcomeEmails', 'welcomeEmailTemplateId')
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM "notification_configuration"
            WHERE "event" = 'USER_CREATED'::"notification_configuration_event_enum"
              AND "notes" = 'Migrado desde Emails Automáticos: envío de credenciales al crear usuario.'
        `);

        await queryRunner.query(`
            UPDATE "mail_template"
            SET "deletedAt" = NULL,
                "updatedAt" = now()
            WHERE "purpose" = 'WELCOME'
        `);
    }
}
