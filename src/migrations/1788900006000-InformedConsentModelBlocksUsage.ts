import { MigrationInterface, QueryRunner } from 'typeorm';

export class InformedConsentModelBlocksUsage1788900006000 implements MigrationInterface {
    name = 'InformedConsentModelBlocksUsage1788900006000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "informed_consent_answer_option"
            ADD COLUMN IF NOT EXISTS "blocksUsageOnSelection" boolean NOT NULL DEFAULT false
        `);

        await queryRunner.query(`
            UPDATE "informed_consent_answer_option" option
            SET "blocksUsageOnSelection" = true
            FROM "informed_consent_question" question
            WHERE question.id = option."questionId"
              AND question.kind IN ('TERMS_OF_USE', 'TREATMENT')
              AND option.resolution = 'REJECTS'
        `);

        await queryRunner.query(`
            ALTER TABLE "informed_consent_model"
            DROP COLUMN IF EXISTS "blocksUsageOnRejection"
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "informed_consent_answer_option"
            DROP COLUMN IF EXISTS "blocksUsageOnSelection"
        `);
    }
}
