import { MigrationInterface, QueryRunner } from 'typeorm';

export class CaseEventReasonTrees1779000001027 implements MigrationInterface {
    name = 'CaseEventReasonTrees1779000001027';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS case_event_reason_tree (
                id SERIAL NOT NULL,
                context "case_event_reason_context_enum" NOT NULL,
                "departmentId" integer,
                active boolean NOT NULL DEFAULT true,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_case_event_reason_tree" PRIMARY KEY (id)
            );
        `);
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_case_event_reason_tree_department'
                ) THEN
                    ALTER TABLE case_event_reason_tree
                        ADD CONSTRAINT "FK_case_event_reason_tree_department"
                        FOREIGN KEY ("departmentId")
                        REFERENCES department(id)
                        ON DELETE CASCADE;
                END IF;
            END
            $$;
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_case_event_reason_tree_unique_scope"
                ON case_event_reason_tree (context, COALESCE("departmentId", 0));
        `);
        await queryRunner.query(`
            INSERT INTO case_event_reason_tree (context, "departmentId")
            SELECT DISTINCT context, "departmentId"
            FROM case_event_reason
            ON CONFLICT DO NOTHING;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE IF EXISTS case_event_reason_tree;');
    }
}
