import { MigrationInterface, QueryRunner } from 'typeorm';

export class MailTemplatePurpose1788000000000 implements MigrationInterface {
    name = 'MailTemplatePurpose1788000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            BEGIN
                CREATE TYPE "mail_template_purpose_enum" AS ENUM ('NOTIFICATION', 'WELCOME');
            EXCEPTION WHEN duplicate_object THEN
                NULL;
            END $$;
        `);
        await queryRunner.query(`
            ALTER TABLE "mail_template"
            ADD COLUMN IF NOT EXISTS "purpose" "mail_template_purpose_enum" NOT NULL DEFAULT 'NOTIFICATION'
        `);
        await queryRunner.query(`
            UPDATE "mail_template"
            SET "purpose" = CASE
                WHEN "module" = 'WELCOME' THEN 'WELCOME'::"mail_template_purpose_enum"
                ELSE 'NOTIFICATION'::"mail_template_purpose_enum"
            END
            WHERE "purpose" IS NULL OR "purpose" = 'NOTIFICATION'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mail_template" DROP COLUMN IF EXISTS "purpose"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "mail_template_purpose_enum"`);
    }
}
