import { MigrationInterface, QueryRunner } from 'typeorm';
import { AssessmentTypeEnum } from 'src/modules/assessment/enums/assessment-type.enum';
import { TemplateModuleEnum } from 'src/modules/mail/enums/template-module.enum';

export class InsertWelcomeEmailTemplate1777593001000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO mail_template(name, subject, body, status, module, "isPublic", "createdAt", "updatedAt")
            SELECT
                'First login welcome email',
                'Bienvenido a PSIRA - Tu cuenta de acceso',
                '<p>Hola {{firstName}},</p><p>Se ha creado una cuenta para acceder a PSIRA.</p><p><strong>Usuario:</strong> {{username}}<br><strong>Contraseña temporal:</strong> {{password}}</p><p><a href="{{loginUrl}}">Acceder a PSIRA</a></p><p>Por seguridad, se te pedirá cambiar esta contraseña en tu primer ingreso.</p>',
                '${AssessmentTypeEnum.ACTIVE}',
                '${TemplateModuleEnum.WELCOME}',
                true,
                now(),
                now()
            WHERE NOT EXISTS (
                SELECT 1 FROM mail_template WHERE module = '${TemplateModuleEnum.WELCOME}'
            );
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM mail_template
            WHERE module = '${TemplateModuleEnum.WELCOME}'
              AND name = 'First login welcome email';
        `);
    }
}
