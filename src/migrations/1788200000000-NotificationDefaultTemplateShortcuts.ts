import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationDefaultTemplateShortcuts1788200000000 implements MigrationInterface {
    name = 'NotificationDefaultTemplateShortcuts1788200000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
            UPDATE "mail_template"
            SET "body" = $2::text,
                "updatedAt" = now()
            WHERE "name" = $1::character varying
              AND "body" LIKE '%{{summary.answeredCount}}%'
            `,
            [
                'Resumen periódico de evaluaciones',
                '<p>Hola {{recipient.firstName}},</p><p>Este es el resumen de evaluaciones del período configurado.</p>{{assessmentsTable}}',
            ],
        );

        await queryRunner.query(
            `
            UPDATE "mail_template"
            SET "subject" = $2::character varying,
                "body" = $3::text,
                "updatedAt" = now()
            WHERE "name" = $1::character varying
              AND "body" = '<p>Hola {{recipient.firstName}},</p><p>Se creó un usuario en PSIRA.</p><p>Usuario: {{user.fullName}}</p>'
            `,
            [
                'Creación de usuario',
                'Tu cuenta de PSIRA fue creada',
                '<p>Hola {{user.firstName}},</p><p>Se creó una cuenta para acceder a PSIRA.</p><p><strong>Usuario:</strong> {{username}}<br><strong>Contraseña temporal:</strong> {{password}}</p><p><a href="{{loginUrl}}">Acceder a PSIRA</a></p><p>Por seguridad, se te pedirá cambiar esta contraseña en tu primer ingreso.</p>',
            ],
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
            UPDATE "mail_template"
            SET "body" = $2::text,
                "updatedAt" = now()
            WHERE "name" = $1::character varying
              AND "body" LIKE '%{{assessmentsTable}}%'
            `,
            [
                'Resumen periódico de evaluaciones',
                '<p>Hola {{recipient.firstName}},</p><p>Este es el resumen de evaluaciones del período configurado.</p><p>Respondidas: {{summary.answeredCount}}. Pendientes: {{summary.pendingCount}}.</p>',
            ],
        );
    }
}
