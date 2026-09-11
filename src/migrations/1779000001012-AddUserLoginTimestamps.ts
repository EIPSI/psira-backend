import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserLoginTimestamps1779000001012 implements MigrationInterface {
    name = 'AddUserLoginTimestamps1779000001012';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "firstLoginAt" timestamp',
        );
        await queryRunner.query(
            'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "lastLoginAt" timestamp',
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE "user" DROP COLUMN IF EXISTS "lastLoginAt"',
        );
        await queryRunner.query(
            'ALTER TABLE "user" DROP COLUMN IF EXISTS "firstLoginAt"',
        );
    }
}
