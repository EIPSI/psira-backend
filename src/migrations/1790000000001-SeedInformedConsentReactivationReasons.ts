import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedInformedConsentReactivationReasons1790000000001 implements MigrationInterface {
    name = 'SeedInformedConsentReactivationReasons1790000000001';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await this.ensureTree(queryRunner, 'INFORMED_CONSENT_REACTIVATION');

        await this.seedReasonTree(queryRunner, 'INFORMED_CONSENT_REACTIVATION', [
            ['Error al responder', null, 10, false],
            ['Arrepentimiento o cambio de decisión', null, 20, false],
            ['Aclaración posterior', null, 30, false],
            ['Otro motivo', null, 90, true],
        ]);
    }

    public async down(): Promise<void> {}

    private async ensureTree(queryRunner: QueryRunner, context: string): Promise<void> {
        await queryRunner.query(`
            INSERT INTO case_event_reason_tree (context, "departmentId", active, "levelLabels", "createdAt", "updatedAt")
            SELECT $1::case_event_reason_context_enum, NULL, true, '["Motivo"]', now(), now()
            WHERE NOT EXISTS (
                SELECT 1
                FROM case_event_reason_tree
                WHERE context = $1::case_event_reason_context_enum
                  AND "departmentId" IS NULL
            );
        `, [context]);
    }

    private async seedReasonTree(
        queryRunner: QueryRunner,
        context: string,
        rows: Array<[string, string | null, number, boolean]>,
    ): Promise<void> {
        for (const [label, parentLabel, sortOrder, isOther] of rows) {
            const parentExpression = parentLabel
                ? `(SELECT id FROM case_event_reason WHERE context = $1::case_event_reason_context_enum AND lower(label) = lower($2) AND "parentId" IS NULL AND "departmentId" IS NULL LIMIT 1)`
                : 'NULL';
            const params = parentLabel
                ? [context, parentLabel, label, sortOrder, isOther]
                : [context, label, sortOrder, isOther];
            await queryRunner.query(`
                INSERT INTO case_event_reason (context, label, "parentId", "departmentId", active, "sortOrder", "isOther", "createdAt", "updatedAt")
                SELECT
                    $1::case_event_reason_context_enum,
                    ${parentLabel ? '$3::varchar' : '$2::varchar'},
                    ${parentExpression},
                    NULL,
                    true,
                    ${parentLabel ? '$4' : '$3'},
                    ${parentLabel ? '$5' : '$4'},
                    now(),
                    now()
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM case_event_reason
                    WHERE context = $1::case_event_reason_context_enum
                      AND lower(label) = lower(${parentLabel ? '$3::varchar' : '$2::varchar'})
                      AND COALESCE("parentId", 0) = COALESCE(${parentExpression}, 0)
                      AND "departmentId" IS NULL
                );
            `, params);
        }
    }
}
