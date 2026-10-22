import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConsentRemindersAndDefaults1790800000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "informed_consent_management"
            ADD COLUMN IF NOT EXISTS "reminderOffsets" jsonb NOT NULL DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS "reminderUnit" varchar NOT NULL DEFAULT 'DAYS'`);
        await queryRunner.query(`
            INSERT INTO "notification_configuration"
                ("departmentId", "channel", "family", "event", "recipientRoleId", "mailTemplateId", "active", "notes", "createdAt", "updatedAt")
            SELECT NULL, 'EMAIL', 'INFORMED_CONSENT', definition.event::notification_configuration_event_enum, role.id, template.id, true,
                'Default informed consent notification', now(), now()
            FROM "role" role CROSS JOIN (VALUES
                ('INFORMED_CONSENT_PENDING', 'Consentimiento informado pendiente'),
                ('INFORMED_CONSENT_SUBMITTED', 'Consentimiento informado respondido'),
                ('INFORMED_CONSENT_REJECTED', 'Consentimiento informado rechazado'),
                ('INFORMED_CONSENT_REACTIVATED', 'Consentimiento informado reactivado')
            ) definition(event, name)
            JOIN "mail_template" template ON template.name = definition.name
            WHERE template."deletedAt" IS NULL AND role."deletedAt" IS NULL
            AND NOT EXISTS (SELECT 1 FROM "notification_configuration" config
                WHERE config."departmentId" IS NULL AND config."recipientRoleId" = role.id
                AND config.channel = 'EMAIL' AND config.event::text = definition.event)
        `);
        await queryRunner.query(`UPDATE "notification_preference" SET "enabledEvents" = (
            SELECT jsonb_agg(DISTINCT event)::text FROM (
                SELECT jsonb_array_elements_text(COALESCE("enabledEvents"::jsonb, '[]')) AS event
                UNION ALL SELECT 'INFORMED_CONSENT_PENDING'
            ) events
        )`);
    }
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "notification_configuration" WHERE notes = 'Default informed consent notification'`);
        await queryRunner.query(`ALTER TABLE "informed_consent_management" DROP COLUMN "reminderOffsets", DROP COLUMN "reminderUnit"`);
    }
}
