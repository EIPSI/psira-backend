import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDefaultInformedConsents1788900002000 implements MigrationInterface {
    name = 'SeedDefaultInformedConsents1788900002000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            DECLARE
                terms_model_id integer;
                terms_version_id integer;
                treatment_model_id integer;
                treatment_version_id integer;
                research_general_model_id integer;
                research_general_version_id integer;
                research_clinical_model_id integer;
                research_clinical_version_id integer;
                question_id integer;
                management_id integer;
            BEGIN
                INSERT INTO "informed_consent_model" ("name", "kind", "description", "systemDefault")
                SELECT 'Condiciones de uso de PSIRA', 'TERMS_OF_USE', 'Consentimiento base para utilizar la plataforma.', false
                WHERE NOT EXISTS (SELECT 1 FROM "informed_consent_model" WHERE "name" = 'Condiciones de uso de PSIRA');
                SELECT "id" INTO terms_model_id FROM "informed_consent_model" WHERE "name" = 'Condiciones de uso de PSIRA' LIMIT 1;

                INSERT INTO "informed_consent_version" ("modelId", "versionNumber", "title", "status", "publishedAt", "notes")
                SELECT terms_model_id, 1, 'Condiciones de uso de PSIRA v1', 'PUBLISHED', now(), 'Versión inicial por defecto'
                WHERE NOT EXISTS (SELECT 1 FROM "informed_consent_version" WHERE "modelId" = terms_model_id AND "versionNumber" = 1);
                SELECT "id" INTO terms_version_id FROM "informed_consent_version" WHERE "modelId" = terms_model_id AND "versionNumber" = 1;
                UPDATE "informed_consent_model" SET "currentPublishedVersionId" = terms_version_id WHERE "id" = terms_model_id;

                INSERT INTO "informed_consent_text_block" ("versionId", "orderIndex", "title", "content")
                SELECT terms_version_id, 1, 'Uso de la plataforma', 'Para utilizar PSIRA es necesario aceptar estas condiciones generales. El usuario se compromete a utilizar la plataforma de acuerdo con las normas institucionales y de confidencialidad aplicables.'
                WHERE NOT EXISTS (SELECT 1 FROM "informed_consent_text_block" WHERE "versionId" = terms_version_id AND "orderIndex" = 1);

                INSERT INTO "informed_consent_question" ("versionId", "kind", "questionType", "orderIndex", "label", "required")
                SELECT terms_version_id, 'TERMS_OF_USE', 'SINGLE_CHOICE', 1, 'Acepto las condiciones de uso de PSIRA.', true
                WHERE NOT EXISTS (SELECT 1 FROM "informed_consent_question" WHERE "versionId" = terms_version_id AND "orderIndex" = 1);
                SELECT "id" INTO question_id FROM "informed_consent_question" WHERE "versionId" = terms_version_id AND "orderIndex" = 1;
                INSERT INTO "informed_consent_answer_option" ("questionId", "orderIndex", "value", "label", "resolution")
                SELECT question_id, options.order_index, options.value, options.label, options.resolution
                FROM (
                    VALUES
                        (1, 'accept', 'Acepto', 'ACCEPTS'),
                        (2, 'reject', 'No acepto', 'REJECTS')
                ) AS options(order_index, value, label, resolution)
                WHERE NOT EXISTS (
                    SELECT 1 FROM "informed_consent_answer_option"
                    WHERE "questionId" = question_id AND "value" = options.value
                );

                INSERT INTO "informed_consent_model" ("name", "kind", "description", "systemDefault")
                SELECT 'Consentimiento de tratamiento', 'TREATMENT', 'Consentimiento informado general para iniciar o continuar tratamiento.', false
                WHERE NOT EXISTS (SELECT 1 FROM "informed_consent_model" WHERE "name" = 'Consentimiento de tratamiento');
                SELECT "id" INTO treatment_model_id FROM "informed_consent_model" WHERE "name" = 'Consentimiento de tratamiento' LIMIT 1;

                INSERT INTO "informed_consent_version" ("modelId", "versionNumber", "title", "status", "publishedAt", "notes")
                SELECT treatment_model_id, 1, 'Consentimiento de tratamiento v1', 'PUBLISHED', now(), 'Versión inicial por defecto'
                WHERE NOT EXISTS (SELECT 1 FROM "informed_consent_version" WHERE "modelId" = treatment_model_id AND "versionNumber" = 1);
                SELECT "id" INTO treatment_version_id FROM "informed_consent_version" WHERE "modelId" = treatment_model_id AND "versionNumber" = 1;
                UPDATE "informed_consent_model" SET "currentPublishedVersionId" = treatment_version_id WHERE "id" = treatment_model_id;

                INSERT INTO "informed_consent_text_block" ("versionId", "orderIndex", "title", "content")
                SELECT treatment_version_id, 1, 'Tratamiento', 'Este consentimiento registra la aceptación para participar en un proceso de tratamiento o supervisión clínica según corresponda, incluyendo el registro de información necesaria para el seguimiento profesional.'
                WHERE NOT EXISTS (SELECT 1 FROM "informed_consent_text_block" WHERE "versionId" = treatment_version_id AND "orderIndex" = 1);

                INSERT INTO "informed_consent_question" ("versionId", "kind", "questionType", "orderIndex", "label", "required")
                SELECT treatment_version_id, 'TREATMENT', 'SINGLE_CHOICE', 1, 'Acepto participar en el proceso de tratamiento informado.', true
                WHERE NOT EXISTS (SELECT 1 FROM "informed_consent_question" WHERE "versionId" = treatment_version_id AND "orderIndex" = 1);
                SELECT "id" INTO question_id FROM "informed_consent_question" WHERE "versionId" = treatment_version_id AND "orderIndex" = 1;
                INSERT INTO "informed_consent_answer_option" ("questionId", "orderIndex", "value", "label", "resolution")
                SELECT question_id, options.order_index, options.value, options.label, options.resolution
                FROM (
                    VALUES
                        (1, 'accept', 'Acepto', 'ACCEPTS'),
                        (2, 'reject', 'No acepto', 'REJECTS')
                ) AS options(order_index, value, label, resolution)
                WHERE NOT EXISTS (
                    SELECT 1 FROM "informed_consent_answer_option"
                    WHERE "questionId" = question_id AND "value" = options.value
                );

                INSERT INTO "informed_consent_model" ("name", "kind", "description", "systemDefault")
                SELECT 'Consentimiento de investigación general', 'RESEARCH', 'Consentimiento opcional para uso de datos generales no clínicos en investigación.', false
                WHERE NOT EXISTS (SELECT 1 FROM "informed_consent_model" WHERE "name" = 'Consentimiento de investigación general');
                SELECT "id" INTO research_general_model_id FROM "informed_consent_model" WHERE "name" = 'Consentimiento de investigación general' LIMIT 1;

                INSERT INTO "informed_consent_version" ("modelId", "versionNumber", "title", "status", "publishedAt", "notes")
                SELECT research_general_model_id, 1, 'Consentimiento de investigación general v1', 'PUBLISHED', now(), 'Versión inicial por defecto'
                WHERE NOT EXISTS (SELECT 1 FROM "informed_consent_version" WHERE "modelId" = research_general_model_id AND "versionNumber" = 1);
                SELECT "id" INTO research_general_version_id FROM "informed_consent_version" WHERE "modelId" = research_general_model_id AND "versionNumber" = 1;
                UPDATE "informed_consent_model" SET "currentPublishedVersionId" = research_general_version_id WHERE "id" = research_general_model_id;

                INSERT INTO "informed_consent_text_block" ("versionId", "orderIndex", "title", "content")
                SELECT research_general_version_id, 1, 'Investigación general', 'Este consentimiento opcional permite utilizar datos generales de uso de la plataforma con fines de investigación y mejora institucional, de acuerdo con los resguardos de confidencialidad aplicables.'
                WHERE NOT EXISTS (SELECT 1 FROM "informed_consent_text_block" WHERE "versionId" = research_general_version_id AND "orderIndex" = 1);

                INSERT INTO "informed_consent_question" ("versionId", "kind", "questionType", "orderIndex", "label", "required")
                SELECT research_general_version_id, 'RESEARCH', 'SINGLE_CHOICE', 1, 'Acepto el uso de datos generales para investigación.', true
                WHERE NOT EXISTS (SELECT 1 FROM "informed_consent_question" WHERE "versionId" = research_general_version_id AND "orderIndex" = 1);
                SELECT "id" INTO question_id FROM "informed_consent_question" WHERE "versionId" = research_general_version_id AND "orderIndex" = 1;
                INSERT INTO "informed_consent_answer_option" ("questionId", "orderIndex", "value", "label", "resolution")
                SELECT question_id, options.order_index, options.value, options.label, options.resolution
                FROM (
                    VALUES
                        (1, 'accept', 'Acepto', 'ACCEPTS'),
                        (2, 'reject', 'No acepto', 'REJECTS')
                ) AS options(order_index, value, label, resolution)
                WHERE NOT EXISTS (
                    SELECT 1 FROM "informed_consent_answer_option"
                    WHERE "questionId" = question_id AND "value" = options.value
                );

                INSERT INTO "informed_consent_model" ("name", "kind", "description", "systemDefault")
                SELECT 'Consentimiento de investigación clínica', 'RESEARCH', 'Consentimiento opcional para uso de datos clínicos de pacientes en investigación.', false
                WHERE NOT EXISTS (SELECT 1 FROM "informed_consent_model" WHERE "name" = 'Consentimiento de investigación clínica');
                SELECT "id" INTO research_clinical_model_id FROM "informed_consent_model" WHERE "name" = 'Consentimiento de investigación clínica' LIMIT 1;

                INSERT INTO "informed_consent_version" ("modelId", "versionNumber", "title", "status", "publishedAt", "notes")
                SELECT research_clinical_model_id, 1, 'Consentimiento de investigación clínica v1', 'PUBLISHED', now(), 'Versión inicial por defecto'
                WHERE NOT EXISTS (SELECT 1 FROM "informed_consent_version" WHERE "modelId" = research_clinical_model_id AND "versionNumber" = 1);
                SELECT "id" INTO research_clinical_version_id FROM "informed_consent_version" WHERE "modelId" = research_clinical_model_id AND "versionNumber" = 1;
                UPDATE "informed_consent_model" SET "currentPublishedVersionId" = research_clinical_version_id WHERE "id" = research_clinical_model_id;

                INSERT INTO "informed_consent_text_block" ("versionId", "orderIndex", "title", "content")
                SELECT research_clinical_version_id, 1, 'Investigación clínica', 'Este consentimiento opcional permite utilizar datos clínicos de pacientes con fines de investigación, manteniendo los resguardos de confidencialidad y protección de datos sensibles.'
                WHERE NOT EXISTS (SELECT 1 FROM "informed_consent_text_block" WHERE "versionId" = research_clinical_version_id AND "orderIndex" = 1);

                INSERT INTO "informed_consent_question" ("versionId", "kind", "questionType", "orderIndex", "label", "required")
                SELECT research_clinical_version_id, 'RESEARCH', 'SINGLE_CHOICE', 1, 'Acepto el uso de datos clínicos para investigación.', true
                WHERE NOT EXISTS (SELECT 1 FROM "informed_consent_question" WHERE "versionId" = research_clinical_version_id AND "orderIndex" = 1);
                SELECT "id" INTO question_id FROM "informed_consent_question" WHERE "versionId" = research_clinical_version_id AND "orderIndex" = 1;
                INSERT INTO "informed_consent_answer_option" ("questionId", "orderIndex", "value", "label", "resolution")
                SELECT question_id, options.order_index, options.value, options.label, options.resolution
                FROM (
                    VALUES
                        (1, 'accept', 'Acepto', 'ACCEPTS'),
                        (2, 'reject', 'No acepto', 'REJECTS')
                ) AS options(order_index, value, label, resolution)
                WHERE NOT EXISTS (
                    SELECT 1 FROM "informed_consent_answer_option"
                    WHERE "questionId" = question_id AND "value" = options.value
                );

                INSERT INTO "informed_consent_management" ("title", "description", "modelId", "status", "trigger", "mandatory", "appliesToAllDepartments", "appliesToAllRoles", "scopeHash", "priority")
                SELECT configs.title, configs.description, configs.model_id, 'ACTIVE', configs.trigger, configs.mandatory, true, configs.all_roles, configs.scope_hash, configs.priority
                FROM (
                    VALUES
                        ('Condiciones de uso - primer login', 'Requisito base para utilizar PSIRA.', terms_model_id, 'FIRST_LOGIN', true, false, 'terms:first-login:all', 10),
                        ('Condiciones de uso - cambio de versión', 'Requiere aceptar nuevamente cuando cambia la versión publicada.', terms_model_id, 'CONSENT_VERSION_CHANGED', true, false, 'terms:version-changed:all', 10),
                        ('Tratamiento - pacientes primer login', 'Consentimiento obligatorio para pacientes.', treatment_model_id, 'FIRST_LOGIN', true, false, 'treatment:first-login:patient', 20),
                        ('Tratamiento - nuevo tratamiento', 'Consentimiento obligatorio al iniciar un nuevo tratamiento.', treatment_model_id, 'NEW_TREATMENT', true, false, 'treatment:new-treatment:patient', 20),
                        ('Tratamiento - cambio de versión', 'Requiere aceptar nuevamente cuando cambia la versión publicada.', treatment_model_id, 'CONSENT_VERSION_CHANGED', true, false, 'treatment:version-changed:patient', 20),
                        ('Investigación general - primer login', 'Consentimiento opcional para usuarios no pacientes.', research_general_model_id, 'FIRST_LOGIN', false, false, 'research-general:first-login:non-patient', 100),
                        ('Investigación general - cambio de versión', 'Ofrece nuevamente el consentimiento cuando cambia la versión publicada.', research_general_model_id, 'CONSENT_VERSION_CHANGED', false, false, 'research-general:version-changed:non-patient', 100),
                        ('Investigación clínica - pacientes primer login', 'Consentimiento opcional para pacientes.', research_clinical_model_id, 'FIRST_LOGIN', false, false, 'research-clinical:first-login:patient', 100),
                        ('Investigación clínica - nuevo tratamiento', 'Ofrece el consentimiento opcional al iniciar un nuevo tratamiento.', research_clinical_model_id, 'NEW_TREATMENT', false, false, 'research-clinical:new-treatment:patient', 100),
                        ('Investigación clínica - cambio de versión', 'Ofrece nuevamente el consentimiento cuando cambia la versión publicada.', research_clinical_model_id, 'CONSENT_VERSION_CHANGED', false, false, 'research-clinical:version-changed:patient', 100)
                ) AS configs(title, description, model_id, trigger, mandatory, all_roles, scope_hash, priority)
                WHERE NOT EXISTS (
                    SELECT 1 FROM "informed_consent_management"
                    WHERE "scopeHash" = configs.scope_hash
                );

                FOR management_id IN
                    SELECT "id" FROM "informed_consent_management"
                    WHERE "scopeHash" IN (
                        'terms:first-login:all',
                        'terms:version-changed:all'
                    )
                LOOP
                    INSERT INTO "informed_consent_management_role" ("managementId", "roleId")
                    SELECT management_id, role.id
                    FROM role
                    WHERE role.code <> 'SUPER_ADMIN'
                    ON CONFLICT ("managementId", "roleId") DO NOTHING;
                END LOOP;

                FOR management_id IN
                    SELECT "id" FROM "informed_consent_management"
                    WHERE "scopeHash" IN (
                        'treatment:first-login:patient',
                        'treatment:new-treatment:patient',
                        'treatment:version-changed:patient',
                        'research-clinical:first-login:patient',
                        'research-clinical:new-treatment:patient',
                        'research-clinical:version-changed:patient'
                    )
                LOOP
                    INSERT INTO "informed_consent_management_role" ("managementId", "roleId")
                    SELECT management_id, role.id
                    FROM role
                    WHERE role.code = 'PATIENT'
                    ON CONFLICT ("managementId", "roleId") DO NOTHING;
                END LOOP;

                FOR management_id IN
                    SELECT "id" FROM "informed_consent_management"
                    WHERE "scopeHash" IN (
                        'research-general:first-login:non-patient',
                        'research-general:version-changed:non-patient'
                    )
                LOOP
                    INSERT INTO "informed_consent_management_role" ("managementId", "roleId")
                    SELECT management_id, role.id
                    FROM role
                    WHERE role.code NOT IN ('PATIENT', 'SUPER_ADMIN')
                    ON CONFLICT ("managementId", "roleId") DO NOTHING;
                END LOOP;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM "informed_consent_management"
            WHERE "scopeHash" IN (
                'terms:first-login:all',
                'terms:version-changed:all',
                'treatment:first-login:patient',
                'treatment:new-treatment:patient',
                'treatment:version-changed:patient',
                'research-general:first-login:non-patient',
                'research-general:version-changed:non-patient',
                'research-clinical:first-login:patient',
                'research-clinical:new-treatment:patient',
                'research-clinical:version-changed:patient'
            )
        `);

        await queryRunner.query(`
            DELETE FROM "informed_consent_model"
            WHERE "name" IN (
                'Condiciones de uso de PSIRA',
                'Consentimiento de tratamiento',
                'Consentimiento de investigación general',
                'Consentimiento de investigación clínica'
            )
        `);
    }
}
