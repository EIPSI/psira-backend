import { MigrationInterface, QueryRunner } from 'typeorm';

export class DepartmentResearchRoleParity1793404800000 implements MigrationInterface {
    async up(q: QueryRunner): Promise<void> {
        await q.query(`CREATE TABLE department_disclaimer (
            "departmentId" integer NOT NULL REFERENCES department(id) ON DELETE CASCADE,
            type varchar NOT NULL REFERENCES disclaimer(type) ON DELETE CASCADE,
            description text NOT NULL, "updatedAt" timestamp NOT NULL DEFAULT now(),
            PRIMARY KEY("departmentId",type))`);
        for (const table of ['role', 'patient_status', 'assessment_type']) {
            await q.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "departmentIds" text`);
        }
    }
    async down(q: QueryRunner): Promise<void> {
        await q.query(`DROP TABLE department_disclaimer`);
        for (const table of ['role', 'patient_status', 'assessment_type']) {
            await q.query(`ALTER TABLE "${table}" DROP COLUMN "departmentIds"`);
        }
    }
}
