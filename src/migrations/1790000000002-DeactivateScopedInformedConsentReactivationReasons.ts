import { MigrationInterface, QueryRunner } from 'typeorm';

export class DeactivateScopedInformedConsentReactivationReasons1790000000002 implements MigrationInterface {
    name = 'DeactivateScopedInformedConsentReactivationReasons1790000000002';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE case_event_reason_tree
            SET active = false, "updatedAt" = now()
            WHERE context = 'SUPERVISION_INFORMED_CONSENT_REACTIVATION'::case_event_reason_context_enum;
        `);
        await queryRunner.query(`
            UPDATE case_event_reason
            SET active = false, "updatedAt" = now()
            WHERE context = 'SUPERVISION_INFORMED_CONSENT_REACTIVATION'::case_event_reason_context_enum;
        `);
    }

    public async down(): Promise<void> {}
}
