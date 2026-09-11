import { MigrationInterface, QueryRunner } from 'typeorm';

const events = [
    'INFORMED_CONSENT_PENDING',
    'INFORMED_CONSENT_SUBMITTED',
    'INFORMED_CONSENT_REJECTED',
    'INFORMED_CONSENT_REACTIVATED',
];

const templates = [
    {
        name: 'Consentimiento informado pendiente',
        subject: 'Tenés un consentimiento informado pendiente en PSIRA',
        body: '<p>Hola {{recipient.firstName}},</p><p>Tenés pendiente el consentimiento informado {{consent.modelName}}.</p><p><a href="{{consent.pendingLink}}">Revisar consentimientos pendientes</a></p>',
    },
    {
        name: 'Consentimiento informado respondido',
        subject: 'Consentimiento informado respondido en PSIRA',
        body: '<p>Hola {{recipient.firstName}},</p><p>Se respondió el consentimiento informado {{consent.modelName}}.</p><p>Resolución: {{consent.resolution}}</p>',
    },
    {
        name: 'Consentimiento informado rechazado',
        subject: 'Consentimiento informado rechazado en PSIRA',
        body: '<p>Hola {{recipient.firstName}},</p><p>Un consentimiento informado obligatorio fue rechazado.</p><p>Modelo: {{consent.modelName}}</p>',
    },
    {
        name: 'Consentimiento informado reactivado',
        subject: 'Consentimiento informado reactivado en PSIRA',
        body: '<p>Hola {{recipient.firstName}},</p><p>Se reactivó la posibilidad de responder un consentimiento informado.</p><p>Modelo: {{consent.modelName}}</p>',
    },
];

export class InformedConsentNotificationEvents1788900003000 implements MigrationInterface {
    name = 'InformedConsentNotificationEvents1788900003000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            BEGIN
                ALTER TYPE "notification_configuration_family_enum" ADD VALUE IF NOT EXISTS 'INFORMED_CONSENT';
            EXCEPTION WHEN undefined_object THEN
                NULL;
            END $$;
        `);

        for (const event of events) {
            await queryRunner.query(`
                DO $$
                BEGIN
                    ALTER TYPE "notification_configuration_event_enum" ADD VALUE IF NOT EXISTS '${event}';
                EXCEPTION WHEN undefined_object THEN
                    NULL;
                END $$;
            `);
            await queryRunner.query(`
                DO $$
                BEGIN
                    ALTER TYPE "notification_log_event_enum" ADD VALUE IF NOT EXISTS '${event}';
                EXCEPTION WHEN undefined_object THEN
                    NULL;
                END $$;
            `);
        }

        await queryRunner.query(`
            UPDATE "notification_preference"
            SET "enabledEvents" = (
                SELECT jsonb_agg(DISTINCT event)
                FROM (
                    SELECT jsonb_array_elements_text(COALESCE("enabledEvents"::jsonb, '[]'::jsonb)) AS event
                    UNION ALL
                    SELECT unnest(ARRAY[${events.map(event => `'${event}'`).join(', ')}]) AS event
                ) events
            )::text
        `);

        for (const template of templates) {
            await queryRunner.query(
                `
                INSERT INTO "mail_template" ("name", "subject", "body", "status", "purpose", "isPublic", "createdAt", "updatedAt")
                SELECT $1::character varying, $2::character varying, $3::text, 'ACTIVE', 'NOTIFICATION', true, now(), now()
                WHERE NOT EXISTS (
                    SELECT 1 FROM "mail_template" WHERE "name" = $1::character varying
                )
                `,
                [template.name, template.subject, template.body],
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const template of templates) {
            await queryRunner.query(`DELETE FROM "mail_template" WHERE "name" = $1`, [template.name]);
        }
    }
}
