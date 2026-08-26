import { MigrationInterface, QueryRunner } from 'typeorm';

const notificationEvents = [
    'USER_CREATED',
    'FIRST_LOGIN',
    'LAST_LOGIN',
    'SESSION_NUMBER',
    'TREATMENT_FINALIZATION',
    'SESSION_NO_SHOW_CANCELLATION',
    'NEW_TREATMENT',
];

const allPreferenceEvents = [
    'ASSESSMENT_ASSIGNED',
    'ASSESSMENT_ANSWERED',
    'ASSESSMENT_NOT_ANSWERED',
    'ASSESSMENT_PERIODIC_SUMMARY',
    'CASE_UPDATED',
    ...notificationEvents,
];

const defaultTemplates = [
    {
        name: 'Evaluación asignada',
        subject: 'Tenés una evaluación pendiente en PSIRA',
        body: '<p>Hola {{responder.firstName}},</p><p>Se te asignó una evaluación en PSIRA.</p><p><a href="{{assessment.link}}">Responder evaluación</a></p>',
    },
    {
        name: 'Evaluación respondida',
        subject: 'Evaluación respondida en PSIRA',
        body: '<p>Hola {{recipient.firstName}},</p><p>Se respondió una evaluación vinculada al caso.</p><p>Evaluación: {{assessment.type}}</p>',
    },
    {
        name: 'Evaluación no respondida',
        subject: 'Evaluación pendiente sin responder',
        body: '<p>Hola {{recipient.firstName}},</p><p>Hay una evaluación pendiente que todavía no fue respondida.</p><p>Evaluación: {{assessment.type}}</p>',
    },
    {
        name: 'Resumen periódico de evaluaciones',
        subject: 'Resumen periódico de evaluaciones',
        body: '<p>Hola {{recipient.firstName}},</p><p>Este es el resumen de evaluaciones del período configurado.</p>{{assessmentsTable}}',
    },
    {
        name: 'Actualización del caso',
        subject: 'Actualización del caso en PSIRA',
        body: '<p>Hola {{recipient.firstName}},</p><p>Se registró una actualización relevante en PSIRA.</p>',
    },
    {
        name: 'Creación de usuario',
        subject: 'Tu cuenta de PSIRA fue creada',
        body: '<p>Hola {{user.firstName}},</p><p>Se creó una cuenta para acceder a PSIRA.</p><p><strong>Usuario:</strong> {{username}}<br><strong>Contraseña temporal:</strong> {{password}}</p><p><a href="{{loginUrl}}">Acceder a PSIRA</a></p><p>Por seguridad, se te pedirá cambiar esta contraseña en tu primer ingreso.</p>',
    },
    {
        name: 'Primer login',
        subject: 'Primer ingreso registrado en PSIRA',
        body: '<p>Hola {{recipient.firstName}},</p><p>Se registró el primer ingreso de un usuario a PSIRA.</p><p>Usuario: {{user.fullName}}</p>',
    },
    {
        name: 'Último login',
        subject: 'Aviso de actividad de login en PSIRA',
        body: '<p>Hola {{recipient.firstName}},</p><p>Se activó una notificación vinculada al último ingreso de un usuario.</p><p>Último login: {{user.lastLoginAt}}</p>',
    },
    {
        name: 'Sesión X',
        subject: 'Automatización activada por sesión',
        body: '<p>Hola {{recipient.firstName}},</p><p>Se activó una notificación vinculada a una sesión específica.</p><p>Sesión: {{session.number}}</p>',
    },
    {
        name: 'Finalización de tratamiento',
        subject: 'Finalización registrada en PSIRA',
        body: '<p>Hola {{recipient.firstName}},</p><p>Se registró la finalización de un tratamiento o supervisión.</p><p>Motivo: {{reason.label}}</p>',
    },
    {
        name: 'Cancelación por falta',
        subject: 'Sesión cancelada por falta',
        body: '<p>Hola {{recipient.firstName}},</p><p>Se registró una cancelación por falta.</p><p>Motivo: {{reason.label}}</p>',
    },
    {
        name: 'Nuevo tratamiento',
        subject: 'Nuevo tratamiento registrado en PSIRA',
        body: '<p>Hola {{recipient.firstName}},</p><p>Se registró un nuevo tratamiento o supervisión.</p><p>Motivo: {{reason.label}}</p>',
    },
];

export class NotificationAutomationEventsAndDefaultTemplates1788100000000 implements MigrationInterface {
    name = 'NotificationAutomationEventsAndDefaultTemplates1788100000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const event of notificationEvents) {
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
            SET "enabledEvents" = '${JSON.stringify(allPreferenceEvents)}'
            WHERE "enabledEvents" IS NULL
               OR "enabledEvents" = '["ASSESSMENT_ANSWERED","ASSESSMENT_NOT_ANSWERED","ASSESSMENT_PERIODIC_SUMMARY","CASE_UPDATED"]'
        `);

        for (const template of defaultTemplates) {
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
        for (const template of defaultTemplates) {
            await queryRunner.query(`DELETE FROM "mail_template" WHERE "name" = $1`, [template.name]);
        }
    }
}
