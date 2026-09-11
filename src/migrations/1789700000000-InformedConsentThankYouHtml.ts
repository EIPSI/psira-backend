import { MigrationInterface, QueryRunner } from 'typeorm';

export class InformedConsentThankYouHtml1789700000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "informed_consent_version"
            ADD COLUMN IF NOT EXISTS "thankYouHtml" text
        `);
        await queryRunner.query(`
            UPDATE "informed_consent_version"
            SET "thankYouHtml" = '<p>Gracias. Tu respuesta fue registrada correctamente.</p>'
            WHERE "thankYouHtml" IS NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "informed_consent_version"
            DROP COLUMN IF EXISTS "thankYouHtml"
        `);
    }
}
