import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeSupportedLanguages1790400000000 implements MigrationInterface {
    name = 'NormalizeSupportedLanguages1790400000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO "language" ("code", "name", "nativeName", "active", "isDefault", "fallbackCode")
            VALUES
                ('en', 'English', 'English', true, true, NULL),
                ('es', 'Spanish', 'Español', true, false, 'en'),
                ('de', 'German', 'Deutsch', true, false, 'en'),
                ('nl', 'Dutch', 'Dutch', true, false, 'en')
            ON CONFLICT ("code") DO UPDATE SET
                "name" = EXCLUDED."name",
                "nativeName" = EXCLUDED."nativeName",
                "active" = EXCLUDED."active",
                "fallbackCode" = EXCLUDED."fallbackCode",
                "updatedAt" = now()
        `);
        await queryRunner.query(`UPDATE "language" SET "isDefault" = false WHERE "code" <> 'en'`);
        await queryRunner.query(`UPDATE "language" SET "isDefault" = true, "active" = true WHERE "code" = 'en'`);
        await queryRunner.query(`DELETE FROM "language" WHERE "code" IN ('sq', 'sw')`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "language" WHERE "code" = 'nl'`);
        await queryRunner.query(`UPDATE "language" SET "active" = false WHERE "code" = 'de'`);
        await queryRunner.query(`
            INSERT INTO "language" ("code", "name", "nativeName", "active", "isDefault", "fallbackCode")
            VALUES
                ('sq', 'Albanian', 'Shqip', false, false, 'en'),
                ('sw', 'Swahili', 'Kiswahili', false, false, 'en')
            ON CONFLICT ("code") DO NOTHING
        `);
    }
}
