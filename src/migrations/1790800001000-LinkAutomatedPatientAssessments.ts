import { MigrationInterface, QueryRunner } from 'typeorm';

export class LinkAutomatedPatientAssessments1790800001000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "evaluation_scheme_assignment" assignment SET "patientId" = patient.id
            FROM "patient" patient
            WHERE assignment."patientId" IS NULL AND assignment."targetUserId" = patient."userId"
              AND patient."deletedAt" IS NULL
              AND NOT EXISTS (SELECT 1 FROM "patient" other
                  WHERE other."userId" = patient."userId" AND other.id <> patient.id AND other."deletedAt" IS NULL)
              AND EXISTS (SELECT 1 FROM "evaluation_automation_run" run
                  WHERE run."resourceType" = 'EVALUATION_SCHEME_ASSIGNMENT' AND run."resourceId" = assignment.id)
        `);
        await queryRunner.query(`
            UPDATE "assessment" assessment SET "patientId" = patient.id
            FROM "patient" patient
            WHERE assessment."patientId" IS NULL AND assessment."targetUserId" = patient."userId"
              AND patient."deletedAt" IS NULL AND assessment."deletedAt" IS NULL
              AND NOT EXISTS (SELECT 1 FROM "patient" other
                  WHERE other."userId" = patient."userId" AND other.id <> patient.id AND other."deletedAt" IS NULL)
              AND (EXISTS (SELECT 1 FROM "evaluation_automation_run" run
                      WHERE run."resourceType" = 'ASSESSMENT' AND run."resourceId" = assessment.id)
                   OR EXISTS (SELECT 1 FROM "evaluation_scheme_assignment" assignment
                      WHERE assignment.id = assessment."schemeAssignmentId" AND assignment."patientId" = patient.id))
        `);
        await queryRunner.query(`
            UPDATE "calendar_occurrence" occurrence SET "patientId" = assignment."patientId"
            FROM "evaluation_scheme_assignment" assignment
            WHERE occurrence."schemeAssignmentId" = assignment.id
              AND occurrence."patientId" IS NULL AND assignment."patientId" IS NOT NULL
        `);
        await queryRunner.query(`
            UPDATE "calendar_occurrence" occurrence SET "patientId" = assessment."patientId"
            FROM "assessment" assessment
            WHERE assessment."calendarOccurrenceId" = occurrence.id
              AND occurrence."patientId" IS NULL AND assessment."patientId" IS NOT NULL
        `);
    }

    public async down(): Promise<void> {
        // Preserve valid clinical links when rolling back application code.
    }
}
