import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRandomizationReferences1779000001009
    implements MigrationInterface
{
    name = 'AddRandomizationReferences1779000001009';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "scheme_resource_template"
            ADD COLUMN IF NOT EXISTS "randomizationRuleIds" text;
        `);
        await queryRunner.query(`
            ALTER TABLE "independent_evaluation_template"
            ADD COLUMN IF NOT EXISTS "randomizationRuleIds" text;
        `);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "independent_evaluation_template"
            DROP COLUMN IF EXISTS "randomizationRuleIds";
        `);
        await queryRunner.query(`
            ALTER TABLE "scheme_resource_template"
            DROP COLUMN IF EXISTS "randomizationRuleIds";
        `);
    }
}
