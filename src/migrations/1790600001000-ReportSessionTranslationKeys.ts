import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReportSessionTranslationKeys1790600001000 implements MigrationInterface {
    name = 'ReportSessionTranslationKeys1790600001000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO "translation_key" ("key", "namespace", "defaultText", "description", "variables", "isSystem")
            VALUES
                ('reports.reports', 'reports', 'Reports', 'Reports list tab title.', '', true),
                ('reports.usage', 'reports', 'Report usage', 'Report usage audit tab title.', '', true),
                ('reports.user', 'reports', 'User', 'Column showing the user who opened a report.', '', true),
                ('reports.patient', 'reports', 'Patient', 'Column showing the patient context of a report usage session.', '', true),
                ('reports.context', 'reports', 'Context', 'Column showing where the report was opened from.', '', true),
                ('reports.contextGeneral', 'reports', 'General', 'General report usage context label.', '', true),
                ('reports.contextPatient', 'reports', 'Patient', 'Patient report usage context label.', '', true),
                ('reports.contextTherapist', 'reports', 'Therapist', 'Therapist report usage context label.', '', true),
                ('reports.contextSupervisor', 'reports', 'Supervisor', 'Supervisor report usage context label.', '', true),
                ('reports.contextUser', 'reports', 'User', 'User report usage context label.', '', true),
                ('reports.startedAt', 'reports', 'Started', 'Column showing when a report usage session started.', '', true),
                ('reports.lastSeenAt', 'reports', 'Last activity', 'Column showing the last heartbeat seen for a report usage session.', '', true),
                ('reports.endedAt', 'reports', 'Ended', 'Column showing when a report usage session ended.', '', true),
                ('reports.duration', 'reports', 'Duration', 'Column showing report usage duration.', '', true),
                ('reports.unableLoadReportSessions', 'reports', 'Unable to load report usage', 'Error shown when report usage audit records cannot be loaded.', '', true)
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
                    ('en', 'reports.reports', 'Reports'),
                    ('en', 'reports.usage', 'Report usage'),
                    ('en', 'reports.user', 'User'),
                    ('en', 'reports.patient', 'Patient'),
                    ('en', 'reports.context', 'Context'),
                    ('en', 'reports.contextGeneral', 'General'),
                    ('en', 'reports.contextPatient', 'Patient'),
                    ('en', 'reports.contextTherapist', 'Therapist'),
                    ('en', 'reports.contextSupervisor', 'Supervisor'),
                    ('en', 'reports.contextUser', 'User'),
                    ('en', 'reports.startedAt', 'Started'),
                    ('en', 'reports.lastSeenAt', 'Last activity'),
                    ('en', 'reports.endedAt', 'Ended'),
                    ('en', 'reports.duration', 'Duration'),
                    ('en', 'reports.unableLoadReportSessions', 'Unable to load report usage'),
                    ('es', 'reports.reports', 'Informes'),
                    ('es', 'reports.usage', 'Uso de informes'),
                    ('es', 'reports.user', 'Usuario'),
                    ('es', 'reports.patient', 'Paciente'),
                    ('es', 'reports.context', 'Contexto'),
                    ('es', 'reports.contextGeneral', 'General'),
                    ('es', 'reports.contextPatient', 'Paciente'),
                    ('es', 'reports.contextTherapist', 'Terapeuta'),
                    ('es', 'reports.contextSupervisor', 'Supervisor'),
                    ('es', 'reports.contextUser', 'Usuario'),
                    ('es', 'reports.startedAt', 'Inicio'),
                    ('es', 'reports.lastSeenAt', 'Última actividad'),
                    ('es', 'reports.endedAt', 'Finalización'),
                    ('es', 'reports.duration', 'Duración'),
                    ('es', 'reports.unableLoadReportSessions', 'No se pudo cargar el uso de informes'),
                    ('de', 'reports.reports', 'Berichte'),
                    ('de', 'reports.usage', 'Report usage'),
                    ('de', 'reports.user', 'User'),
                    ('de', 'reports.patient', 'Patient'),
                    ('de', 'reports.context', 'Context'),
                    ('de', 'reports.contextGeneral', 'General'),
                    ('de', 'reports.contextPatient', 'Patient'),
                    ('de', 'reports.contextTherapist', 'Therapist'),
                    ('de', 'reports.contextSupervisor', 'Supervisor'),
                    ('de', 'reports.contextUser', 'User'),
                    ('de', 'reports.startedAt', 'Started'),
                    ('de', 'reports.lastSeenAt', 'Last activity'),
                    ('de', 'reports.endedAt', 'Ended'),
                    ('de', 'reports.duration', 'Duration'),
                    ('de', 'reports.unableLoadReportSessions', 'Unable to load report usage'),
                    ('nl', 'reports.reports', 'Reports'),
                    ('nl', 'reports.usage', 'Report usage'),
                    ('nl', 'reports.user', 'User'),
                    ('nl', 'reports.patient', 'Patient'),
                    ('nl', 'reports.context', 'Context'),
                    ('nl', 'reports.contextGeneral', 'General'),
                    ('nl', 'reports.contextPatient', 'Patient'),
                    ('nl', 'reports.contextTherapist', 'Therapist'),
                    ('nl', 'reports.contextSupervisor', 'Supervisor'),
                    ('nl', 'reports.contextUser', 'User'),
                    ('nl', 'reports.startedAt', 'Started'),
                    ('nl', 'reports.lastSeenAt', 'Last activity'),
                    ('nl', 'reports.endedAt', 'Ended'),
                    ('nl', 'reports.duration', 'Duration'),
                    ('nl', 'reports.unableLoadReportSessions', 'Unable to load report usage')
            ) AS seed("languageCode", "key", "value") ON seed."languageCode" = language.code
            ON CONFLICT ("languageId", "key") DO UPDATE SET
                "value" = EXCLUDED."value",
                "updatedAt" = now()
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM "translation_value"
            WHERE "key" IN (
                'reports.reports',
                'reports.usage',
                'reports.user',
                'reports.patient',
                'reports.context',
                'reports.contextGeneral',
                'reports.contextPatient',
                'reports.contextTherapist',
                'reports.contextSupervisor',
                'reports.contextUser',
                'reports.startedAt',
                'reports.lastSeenAt',
                'reports.endedAt',
                'reports.duration',
                'reports.unableLoadReportSessions'
            )
        `);
        await queryRunner.query(`
            DELETE FROM "translation_key"
            WHERE "key" IN (
                'reports.reports',
                'reports.usage',
                'reports.user',
                'reports.patient',
                'reports.context',
                'reports.contextGeneral',
                'reports.contextPatient',
                'reports.contextTherapist',
                'reports.contextSupervisor',
                'reports.contextUser',
                'reports.startedAt',
                'reports.lastSeenAt',
                'reports.endedAt',
                'reports.duration',
                'reports.unableLoadReportSessions'
            )
        `);
    }
}
