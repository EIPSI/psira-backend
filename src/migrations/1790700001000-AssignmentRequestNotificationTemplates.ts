import { MigrationInterface, QueryRunner } from 'typeorm';

const oldGenericTemplateName = 'Solicitud de asignación clínica';
const oldGenericEvent = 'CASE_ASSIGNMENT_REQUEST';

const events = [
    {
        event: 'CASE_MANAGER_ASSIGNMENT_REQUEST',
        templateName: 'Solicitud de administrador de caso',
        subject: 'Nueva solicitud para administrar un caso en PSIRA',
        body: '<p>Hola {{recipient.firstName}},</p><p>{{assignment.requesterName}} te solicitó aceptar una asignación como administrador de caso.</p><p>Paciente: <strong>{{assignment.targetName}}</strong></p><p>Podés aceptar o rechazar la solicitud desde el panel general.</p><p><a href="{{assignment.link}}">Ir al panel de control</a></p>',
        roles: ['SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'THERAPIST'],
        notes: 'Configuración por defecto: email al usuario cuando recibe una solicitud de administración de caso.',
    },
    {
        event: 'CASE_SUPERVISOR_ASSIGNMENT_REQUEST',
        templateName: 'Solicitud de supervisor de terapeuta',
        subject: 'Nueva solicitud de supervisión en PSIRA',
        body: '<p>Hola {{recipient.firstName}},</p><p>{{assignment.requesterName}} te solicitó aceptar una asignación como supervisor.</p><p>Terapeuta: <strong>{{assignment.targetName}}</strong></p><p>Podés aceptar o rechazar la solicitud desde el panel general.</p><p><a href="{{assignment.link}}">Ir al panel de control</a></p>',
        roles: ['SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'SUPERVISOR'],
        notes: 'Configuración por defecto: email al usuario cuando recibe una solicitud de supervisión de terapeuta.',
    },
];

export class AssignmentRequestNotificationTemplates1790700001000 implements MigrationInterface {
    name = 'AssignmentRequestNotificationTemplates1790700001000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM "notification_configuration"
            WHERE "event"::text = '${oldGenericEvent}'
              AND "notes" = 'Configuración por defecto: email al usuario cuando recibe una solicitud de asignación clínica.'
        `);
        await queryRunner.query(`DELETE FROM "mail_template" WHERE "name" = $1`, [oldGenericTemplateName]);

        for (const item of events) {
            await queryRunner.query(`
                INSERT INTO "mail_template" ("name", "subject", "body", "status", "purpose", "isPublic", "createdAt", "updatedAt")
                SELECT
                    $1::character varying,
                    $2::character varying,
                    $3::text,
                    'ACTIVE',
                    'NOTIFICATION',
                    false,
                    now(),
                    now()
                WHERE NOT EXISTS (
                    SELECT 1 FROM "mail_template" WHERE "name" = $1::character varying
                )
            `, [item.templateName, item.subject, item.body]);

            await queryRunner.query(`
                INSERT INTO "notification_configuration"
                    ("departmentId", "channel", "family", "event", "recipientRoleId", "mailTemplateId", "active", "notes", "createdAt", "updatedAt")
                SELECT
                    NULL,
                    'EMAIL'::"notification_configuration_channel_enum",
                    'CASE'::"notification_configuration_family_enum",
                    '${item.event}'::"notification_configuration_event_enum",
                    role.id,
                    template.id,
                    true,
                    $2::character varying,
                    now(),
                    now()
                FROM "role" role
                CROSS JOIN "mail_template" template
                WHERE role.code = ANY($3::text[])
                  AND template.name = $1::character varying
                  AND template."deletedAt" IS NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM "notification_configuration" configuration
                      WHERE configuration."departmentId" IS NULL
                        AND configuration."channel" = 'EMAIL'::"notification_configuration_channel_enum"
                        AND configuration."event" = '${item.event}'::"notification_configuration_event_enum"
                        AND configuration."recipientRoleId" = role.id
                  )
            `, [item.templateName, item.notes, item.roles]);
        }

        await queryRunner.query(`
            UPDATE "notification_preference"
            SET "enabledEvents" = (
                SELECT jsonb_agg(DISTINCT enabled_event)
                FROM (
                    SELECT jsonb_array_elements_text(COALESCE("enabledEvents"::jsonb, '[]'::jsonb)) AS enabled_event
                    UNION ALL
                    SELECT unnest(ARRAY[${events.map(item => `'${item.event}'`).join(', ')}]) AS enabled_event
                ) events
            )::text
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const item of events) {
            await queryRunner.query(`
                DELETE FROM "notification_configuration"
                WHERE "event"::text = '${item.event}'
                  AND "notes" = $1::character varying
            `, [item.notes]);
            await queryRunner.query(`DELETE FROM "mail_template" WHERE "name" = $1`, [item.templateName]);
        }
    }
}
