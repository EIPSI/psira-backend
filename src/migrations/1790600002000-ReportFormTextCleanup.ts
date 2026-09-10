import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReportFormTextCleanup1790600002000 implements MigrationInterface {
    name = 'ReportFormTextCleanup1790600002000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO "translation_key" ("key", "namespace", "defaultText", "description", "variables", "isSystem")
            VALUES
                ('core.on', 'core', 'On', 'Enabled option label used in switches and radio controls.', '', true),
                ('core.off', 'core', 'Off', 'Disabled option label used in switches and radio controls.', '', true),
                ('reports.rolesRequiredValidation', 'reports', 'Select at least one role that can access this report.', 'Validation message shown when a report is saved without allowed roles.', '', true)
            ON CONFLICT ("key") DO UPDATE SET
                "namespace" = EXCLUDED."namespace",
                "defaultText" = EXCLUDED."defaultText",
                "description" = EXCLUDED."description",
                "updatedAt" = now()
        `);

        await queryRunner.query(`
            INSERT INTO "translation_value" ("languageId", "languageCode", "key", "value")
            SELECT language.id, language.code, seed.key, seed.value
            FROM "language" language
            JOIN (
                VALUES
                    ('en', 'core.on', 'On'),
                    ('en', 'core.off', 'Off'),
                    ('en', 'reports.rolesRequiredValidation', 'Select at least one role that can access this report.'),
                    ('en', 'forms.createReportForm.repositoryLinkDescription', 'Optional technical reference, such as the Git repository, documentation, script, or internal folder where this report is maintained.'),
                    ('es', 'core.on', 'Activado'),
                    ('es', 'core.off', 'Desactivado'),
                    ('es', 'reports.rolesRequiredValidation', 'Seleccioná al menos un rol que pueda acceder a este informe.'),
                    ('es', 'forms.createReportForm.repositoryLinkDescription', 'Referencia técnica opcional, como el repositorio Git, documentación, script o carpeta interna donde se mantiene este informe.'),
                    ('de', 'core.on', 'On'),
                    ('de', 'core.off', 'Off'),
                    ('de', 'reports.rolesRequiredValidation', 'Select at least one role that can access this report.'),
                    ('de', 'forms.createReportForm.repositoryLinkDescription', 'Optional technical reference, such as the Git repository, documentation, script, or internal folder where this report is maintained.'),
                    ('nl', 'core.on', 'On'),
                    ('nl', 'core.off', 'Off'),
                    ('nl', 'reports.rolesRequiredValidation', 'Select at least one role that can access this report.'),
                    ('nl', 'forms.createReportForm.repositoryLinkDescription', 'Optional technical reference, such as the Git repository, documentation, script, or internal folder where this report is maintained.')
            ) AS seed("languageCode", "key", "value") ON seed."languageCode" = language.code
            ON CONFLICT ("languageId", "key") DO UPDATE SET
                "value" = EXCLUDED."value",
                "updatedAt" = now()
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM "translation_value"
            WHERE "key" IN ('core.on', 'core.off', 'reports.rolesRequiredValidation')
        `);
        await queryRunner.query(`
            DELETE FROM "translation_key"
            WHERE "key" IN ('core.on', 'core.off', 'reports.rolesRequiredValidation')
        `);
    }
}
