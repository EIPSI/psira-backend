import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserSkippedAutomationIds1779000001013 implements MigrationInterface {
    name = 'AddUserSkippedAutomationIds1779000001013';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "skippedAutomationIds" text',
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE "user" DROP COLUMN IF EXISTS "skippedAutomationIds"',
        );
    }
}
