import { MigrationInterface, QueryRunner } from 'typeorm';

export class CaseEventReasonSupervisionContextsAndOther1779000001029 implements MigrationInterface {
    name = 'CaseEventReasonSupervisionContextsAndOther1779000001029';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TYPE "case_event_reason_context_enum"
                ADD VALUE IF NOT EXISTS 'SUPERVISION_SESSION_CANCELLATION';
        `);
        await queryRunner.query(`
            ALTER TYPE "case_event_reason_context_enum"
                ADD VALUE IF NOT EXISTS 'SUPERVISION_FINALIZATION';
        `);
        await queryRunner.query(`
            ALTER TYPE "case_event_reason_context_enum"
                ADD VALUE IF NOT EXISTS 'NEW_SUPERVISION';
        `);
        await queryRunner.query(`
            ALTER TABLE case_event_reason
                ADD COLUMN IF NOT EXISTS "isOther" boolean NOT NULL DEFAULT false;
        `);
        await queryRunner.query(`
            UPDATE case_event_reason
            SET "isOther" = true
            WHERE lower(label) IN ('otro', 'otros', 'otro motivo', 'otros motivos');
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE case_event_reason DROP COLUMN IF EXISTS "isOther"`);
    }

}
