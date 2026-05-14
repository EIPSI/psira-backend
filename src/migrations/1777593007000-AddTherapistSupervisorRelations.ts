import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTherapistSupervisorRelations1777593007000 implements MigrationInterface {
    name = 'AddTherapistSupervisorRelations1777593007000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS therapist_supervisor (
                "therapistId" integer NOT NULL,
                "supervisorId" integer NOT NULL,
                CONSTRAINT "PK_therapist_supervisor" PRIMARY KEY ("therapistId", "supervisorId"),
                CONSTRAINT "FK_therapist_supervisor_therapist" FOREIGN KEY ("therapistId") REFERENCES "user"(id) ON DELETE CASCADE,
                CONSTRAINT "FK_therapist_supervisor_supervisor" FOREIGN KEY ("supervisorId") REFERENCES "user"(id) ON DELETE CASCADE
            );
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_therapist_supervisor_therapist" ON therapist_supervisor ("therapistId");`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_therapist_supervisor_supervisor" ON therapist_supervisor ("supervisorId");`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS therapist_supervisor_patient (
                "therapistId" integer NOT NULL,
                "supervisorId" integer NOT NULL,
                "patientId" integer NOT NULL,
                CONSTRAINT "PK_therapist_supervisor_patient" PRIMARY KEY ("therapistId", "supervisorId", "patientId"),
                CONSTRAINT "FK_therapist_supervisor_patient_therapist" FOREIGN KEY ("therapistId") REFERENCES "user"(id) ON DELETE CASCADE,
                CONSTRAINT "FK_therapist_supervisor_patient_supervisor" FOREIGN KEY ("supervisorId") REFERENCES "user"(id) ON DELETE CASCADE,
                CONSTRAINT "FK_therapist_supervisor_patient_patient" FOREIGN KEY ("patientId") REFERENCES patient(id) ON DELETE CASCADE,
                CONSTRAINT "FK_therapist_supervisor_patient_pair" FOREIGN KEY ("therapistId", "supervisorId") REFERENCES therapist_supervisor ("therapistId", "supervisorId") ON DELETE CASCADE
            );
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_therapist_supervisor_patient_patient" ON therapist_supervisor_patient ("patientId");`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_therapist_supervisor_patient_supervisor" ON therapist_supervisor_patient ("supervisorId");`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS therapist_supervisor_patient;`);
        await queryRunner.query(`DROP TABLE IF EXISTS therapist_supervisor;`);
    }
}
