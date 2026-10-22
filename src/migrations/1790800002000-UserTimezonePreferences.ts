import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserTimezonePreferences1790800002000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user"
            ADD COLUMN IF NOT EXISTS "timezone" varchar,
            ADD COLUMN IF NOT EXISTS "detectedTimezone" varchar`);
        await queryRunner.query(`UPDATE "setting" SET "value" = 'UTC'
            WHERE "key" = 'systemTimezone' AND "value" = 'Africa/Dar_es_Salaam'`);
    }
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "timezone", DROP COLUMN "detectedTimezone"`);
    }
}
