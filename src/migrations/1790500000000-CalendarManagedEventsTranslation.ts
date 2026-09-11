import { MigrationInterface, QueryRunner } from 'typeorm';

export class CalendarManagedEventsTranslation1790500000000 implements MigrationInterface {
    name = 'CalendarManagedEventsTranslation1790500000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "translation_value"
            SET "value" = CASE
                WHEN "languageCode" = 'es' THEN 'Gestión de casos'
                ELSE 'Case management'
            END,
            "updatedAt" = now()
            WHERE "key" = 'calendar.managedEvents'
                AND "languageCode" IN ('en', 'es', 'de', 'nl')
                AND "value" IN (
                    'calendar.managedEvents',
                    'Case administration / supervision',
                    'Administración de caso / supervisión'
                )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "translation_value"
            SET "value" = CASE
                WHEN "languageCode" = 'es' THEN 'Administración de caso / supervisión'
                ELSE 'Case administration / supervision'
            END,
            "updatedAt" = now()
            WHERE "key" = 'calendar.managedEvents'
                AND "languageCode" IN ('en', 'es', 'de', 'nl')
                AND "value" IN ('Gestión de casos', 'Case management')
        `);
    }
}
