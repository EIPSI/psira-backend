import { MigrationInterface, QueryRunner } from 'typeorm';

export class InformedConsentReactivationReasonContexts1790000000000 implements MigrationInterface {
    name = 'InformedConsentReactivationReasonContexts1790000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TYPE "case_event_reason_context_enum"
                ADD VALUE IF NOT EXISTS 'INFORMED_CONSENT_REACTIVATION';
        `);
        await queryRunner.query(`
            ALTER TYPE "case_event_reason_context_enum"
                ADD VALUE IF NOT EXISTS 'SUPERVISION_INFORMED_CONSENT_REACTIVATION';
        `);
    }

    public async down(): Promise<void> {}
}
