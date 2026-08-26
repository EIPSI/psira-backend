import { MigrationInterface, QueryRunner } from 'typeorm';

export class EvaluationSchemeTemplateNames1788800000000 implements MigrationInterface {
    name = 'EvaluationSchemeTemplateNames1788800000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "scheme_resource_template"
            ADD COLUMN IF NOT EXISTS "name" character varying
        `);
        await queryRunner.query(`
            ALTER TABLE "independent_evaluation_template"
            ADD COLUMN IF NOT EXISTS "name" character varying
        `);
        await queryRunner.query(`
            ALTER TABLE "clinical_session_resource"
            ADD COLUMN IF NOT EXISTS "name" character varying
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "clinical_session_resource"
            DROP COLUMN IF EXISTS "name"
        `);
        await queryRunner.query(`
            ALTER TABLE "independent_evaluation_template"
            DROP COLUMN IF EXISTS "name"
        `);
        await queryRunner.query(`
            ALTER TABLE "scheme_resource_template"
            DROP COLUMN IF EXISTS "name"
        `);
    }
}
