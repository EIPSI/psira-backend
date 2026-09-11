import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedSupervisionCaseEventReasons1779000001030 implements MigrationInterface {
    name = 'SeedSupervisionCaseEventReasons1779000001030';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await this.ensureTree(queryRunner, 'SUPERVISION_SESSION_CANCELLATION');
        await this.ensureTree(queryRunner, 'SUPERVISION_FINALIZATION');
        await this.ensureTree(queryRunner, 'NEW_SUPERVISION');

        await this.seedReasonTree(queryRunner, 'SUPERVISION_SESSION_CANCELLATION', [
            ['Terapeuta', null, 10, false],
            ['Paciente', null, 20, false],
            ['Otro motivo', null, 90, true],
        ]);
        await this.seedReasonTree(queryRunner, 'SUPERVISION_FINALIZATION', [
            ['decision unilateral', null, 10, false],
            ['supervisor', 'decision unilateral', 10, false],
            ['terapeuta', 'decision unilateral', 20, false],
            ['acordado', null, 20, false],
            ['cumplimiento de objetivos', 'acordado', 10, false],
            ['derivacion', 'acordado', 20, false],
            ['Otro motivo', null, 90, true],
        ]);
        await this.seedReasonTree(queryRunner, 'NEW_SUPERVISION', [
            ['retorno por nueva demanda', null, 10, false],
            ['continuidad posterior a interrupcion', null, 20, false],
            ['cambio de necesidad de supervision', null, 30, false],
            ['Otro motivo', null, 90, true],
        ]);
    }

    public async down(): Promise<void> {}

    private async ensureTree(queryRunner: QueryRunner, context: string): Promise<void> {
        await queryRunner.query(`
            INSERT INTO case_event_reason_tree (context, "departmentId", active, "createdAt", "updatedAt")
            SELECT $1::case_event_reason_context_enum, NULL, true, now(), now()
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
