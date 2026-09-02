import { MigrationInterface, QueryRunner } from 'typeorm';

export class InformedConsentSubmitButtonLabel1788900005000 implements MigrationInterface {
    name = 'InformedConsentSubmitButtonLabel1788900005000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "informed_consent_version"
            ADD COLUMN IF NOT EXISTS "submitButtonLabel" character varying NOT NULL DEFAULT 'Registrar respuesta'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "informed_consent_version"
            DROP COLUMN IF EXISTS "submitButtonLabel"
        `);
    }
}
