import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClinicalSessionModality1779000001017 implements MigrationInterface {
    name = 'AddClinicalSessionModality1779000001017';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_type WHERE typname = 'clinical_session_modality_enum'
                ) THEN
                    CREATE TYPE "clinical_session_modality_enum"
                        AS ENUM ('IN_PERSON', 'ONLINE');
                END IF;
            END
            $$;
        `);

        await queryRunner.query(`
            ALTER TABLE clinical_session
                ADD COLUMN IF NOT EXISTS "modality" "clinical_session_modality_enum"
                NOT NULL DEFAULT 'IN_PERSON';
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE clinical_session
                DROP COLUMN IF EXISTS "modality";
        `);
        await queryRunner.query(`DROP TYPE IF EXISTS "clinical_session_modality_enum";`);
    }
}
