import { MigrationInterface, QueryRunner } from 'typeorm';

export class InformedConsentQuestionKinds1788900004000 implements MigrationInterface {
    name = 'InformedConsentQuestionKinds1788900004000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "informed_consent_question"
            ADD COLUMN IF NOT EXISTS "kinds" text
        `);
        await queryRunner.query(`
            UPDATE "informed_consent_question"
            SET "kinds" = "kind"
            WHERE "kinds" IS NULL AND "kind" IS NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "informed_consent_question"
            DROP COLUMN IF EXISTS "kinds"
        `);
    }
}
