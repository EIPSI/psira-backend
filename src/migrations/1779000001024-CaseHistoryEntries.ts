import { MigrationInterface, QueryRunner } from 'typeorm';

export class CaseHistoryEntries1779000001024 implements MigrationInterface {
    name = 'CaseHistoryEntries1779000001024';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TYPE "case_history_entry_kind_enum" AS ENUM (
                'NOTE',
                'TREATMENT_FINALIZATION',
                'FINALIZATION_CANCELLED',
                'NEW_TREATMENT'
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "case_history_entry" (
                "id" SERIAL NOT NULL,
                "entryKind" "case_history_entry_kind_enum" NOT NULL,
                "cycleKind" "treatment_cycle_kind_enum" NOT NULL,
                "patientId" integer,
                "therapistId" integer,
                "treatmentCycleId" integer,
                "clinicalSessionId" integer,
                "sessionNumber" integer,
                "occurredAt" TIMESTAMP NOT NULL,
                "title" character varying NOT NULL,
                "content" text,
                "reasonSnapshot" text,
                "metadata" jsonb,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_case_history_entry_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_case_history_entry_kind" ON "case_history_entry" ("entryKind")`);
        await queryRunner.query(`CREATE INDEX "IDX_case_history_entry_cycle" ON "case_history_entry" ("treatmentCycleId")`);
        await queryRunner.query(`CREATE INDEX "IDX_case_history_entry_patient" ON "case_history_entry" ("patientId")`);
        await queryRunner.query(`CREATE INDEX "IDX_case_history_entry_therapist" ON "case_history_entry" ("therapistId")`);
        await queryRunner.query(`CREATE INDEX "IDX_case_history_entry_occurred" ON "case_history_entry" ("occurredAt")`);
        await queryRunner.query(`
            ALTER TABLE "case_history_entry"
            ADD CONSTRAINT "FK_case_history_entry_patient"
            FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "case_history_entry"
            ADD CONSTRAINT "FK_case_history_entry_therapist"
            FOREIGN KEY ("therapistId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "case_history_entry"
            ADD CONSTRAINT "FK_case_history_entry_cycle"
            FOREIGN KEY ("treatmentCycleId") REFERENCES "treatment_cycle"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "case_history_entry"
            ADD CONSTRAINT "FK_case_history_entry_session"
            FOREIGN KEY ("clinicalSessionId") REFERENCES "clinical_session"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "case_history_entry" DROP CONSTRAINT "FK_case_history_entry_session"`);
        await queryRunner.query(`ALTER TABLE "case_history_entry" DROP CONSTRAINT "FK_case_history_entry_cycle"`);
        await queryRunner.query(`ALTER TABLE "case_history_entry" DROP CONSTRAINT "FK_case_history_entry_therapist"`);
        await queryRunner.query(`ALTER TABLE "case_history_entry" DROP CONSTRAINT "FK_case_history_entry_patient"`);
        await queryRunner.query(`DROP INDEX "IDX_case_history_entry_occurred"`);
        await queryRunner.query(`DROP INDEX "IDX_case_history_entry_therapist"`);
        await queryRunner.query(`DROP INDEX "IDX_case_history_entry_patient"`);
        await queryRunner.query(`DROP INDEX "IDX_case_history_entry_cycle"`);
        await queryRunner.query(`DROP INDEX "IDX_case_history_entry_kind"`);
        await queryRunner.query(`DROP TABLE "case_history_entry"`);
        await queryRunner.query(`DROP TYPE "case_history_entry_kind_enum"`);
    }
}
