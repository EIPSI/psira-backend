import { MigrationInterface, QueryRunner } from 'typeorm';

export class LanguageTranslations1790300000000 implements MigrationInterface {
    name = 'LanguageTranslations1790300000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "language" (
                "id" SERIAL CONSTRAINT "PK_language" PRIMARY KEY,
                "code" character varying NOT NULL,
                "name" character varying NOT NULL,
                "nativeName" character varying,
                "active" boolean NOT NULL DEFAULT true,
                "isDefault" boolean NOT NULL DEFAULT false,
                "fallbackCode" character varying,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_language_code" UNIQUE ("code")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "translation_key" (
                "key" character varying CONSTRAINT "PK_translation_key" PRIMARY KEY,
                "namespace" character varying NOT NULL,
                "defaultText" text,
                "description" text,
                "variables" text,
                "isSystem" boolean NOT NULL DEFAULT true,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
            )
        `);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "translation_value" (
                "id" SERIAL CONSTRAINT "PK_translation_value" PRIMARY KEY,
                "languageId" integer NOT NULL,
                "languageCode" character varying NOT NULL,
                "key" character varying NOT NULL,
                "value" text,
                "updatedById" integer,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_translation_value_language_key" UNIQUE ("languageId", "key"),
                CONSTRAINT "FK_translation_value_language" FOREIGN KEY ("languageId") REFERENCES "language"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_translation_value_key" FOREIGN KEY ("key") REFERENCES "translation_key"("key") ON DELETE CASCADE,
                CONSTRAINT "FK_translation_value_updated_by" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL
            )
        `);
        await queryRunner.query(`
            INSERT INTO "language" ("code", "name", "nativeName", "active", "isDefault", "fallbackCode")
            VALUES
                ('en', 'English', 'English', true, true, NULL),
                ('es', 'Spanish', 'Español', true, false, 'en'),
                ('de', 'German', 'Deutsch', false, false, 'en'),
                ('sq', 'Albanian', 'Shqip', false, false, 'en'),
                ('sw', 'Swahili', 'Kiswahili', false, false, 'en')
            ON CONFLICT ("code") DO NOTHING
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "translation_value"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "translation_key"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "language"`);
    }
}
