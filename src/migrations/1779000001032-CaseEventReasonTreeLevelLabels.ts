import { MigrationInterface, QueryRunner } from 'typeorm';

export class CaseEventReasonTreeLevelLabels1779000001032 implements MigrationInterface {
    name = 'CaseEventReasonTreeLevelLabels1779000001032';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE case_event_reason_tree
            ADD COLUMN IF NOT EXISTS "levelLabels" text
        `);
        await queryRunner.query(`
            UPDATE case_event_reason_tree
            SET "levelLabels" = '["Motivo","Submotivo"]'
            WHERE "levelLabels" IS NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE case_event_reason_tree
            DROP COLUMN IF EXISTS "levelLabels"
        `);
    }
}
