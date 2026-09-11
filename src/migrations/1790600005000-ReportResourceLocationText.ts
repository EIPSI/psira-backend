import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReportResourceLocationText1790600005000 implements MigrationInterface {
    name = 'ReportResourceLocationText1790600005000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO "translation_key" ("key", "namespace", "defaultText", "description", "variables", "isSystem")
            VALUES
                ('forms.createReportForm.resources', 'forms', 'Where it appears', 'Label for the report location field. This controls in which PSIRA section the report is shown.', '', true),
                ('forms.createReportForm.resourcesDescription', 'forms', 'Select the general section where this report will appear.', 'Help text for the report location field.', '', true),
                ('forms.createReportForm.resourcesValidation', 'forms', 'Report location is required.', 'Validation shown when the report location field is empty.', '', true),
                ('tables.reports.resources', 'tables', 'Where it appears', 'Column label for the report location/section.', '', true)
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
                    ('en', 'forms.createReportForm.resources', 'Where it appears'),
                    ('en', 'forms.createReportForm.resourcesDescription', 'Select the general section where this report will appear.'),
                    ('en', 'forms.createReportForm.resourcesValidation', 'Report location is required.'),
                    ('en', 'tables.reports.resources', 'Where it appears'),
                    ('es', 'forms.createReportForm.resources', 'Dónde aparece'),
                    ('es', 'forms.createReportForm.resourcesDescription', 'Seleccioná en qué sección general aparecerá este informe.'),
                    ('es', 'forms.createReportForm.resourcesValidation', 'La ubicación del informe es obligatoria.'),
                    ('es', 'tables.reports.resources', 'Dónde aparece'),
                    ('de', 'forms.createReportForm.resources', 'Where it appears'),
                    ('de', 'forms.createReportForm.resourcesDescription', 'Select the general section where this report will appear.'),
                    ('de', 'forms.createReportForm.resourcesValidation', 'Report location is required.'),
                    ('de', 'tables.reports.resources', 'Where it appears'),
                    ('nl', 'forms.createReportForm.resources', 'Where it appears'),
                    ('nl', 'forms.createReportForm.resourcesDescription', 'Select the general section where this report will appear.'),
                    ('nl', 'forms.createReportForm.resourcesValidation', 'Report location is required.'),
                    ('nl', 'tables.reports.resources', 'Where it appears')
            ) AS seed("languageCode", "key", "value") ON seed."languageCode" = language.code
            ON CONFLICT ("languageId", "key") DO UPDATE SET
                "value" = EXCLUDED."value",
                "updatedAt" = now()
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
