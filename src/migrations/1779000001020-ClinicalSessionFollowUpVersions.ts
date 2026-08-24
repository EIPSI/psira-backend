import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClinicalSessionFollowUpVersions1779000001020 implements MigrationInterface {
    name = 'ClinicalSessionFollowUpVersions1779000001020';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS clinical_session_follow_up_version (
                id serial CONSTRAINT "PK_clinical_session_follow_up_version" PRIMARY KEY,
                "clinicalSessionId" integer NOT NULL
                    CONSTRAINT "FK_clinical_session_follow_up_version_session"
                    REFERENCES clinical_session(id),
                "previousText" text NULL,
                "nextText" text NULL,
                "editedByUserId" integer NULL
                    CONSTRAINT "FK_clinical_session_follow_up_version_user"
                    REFERENCES "user"(id),
                "createdAt" TIMESTAMP NOT NULL DEFAULT now()
            );
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_clinical_session_follow_up_version_session" ON clinical_session_follow_up_version ("clinicalSessionId", "createdAt");`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_clinical_session_follow_up_version_session";`);
        await queryRunner.query(`DROP TABLE IF EXISTS clinical_session_follow_up_version;`);
    }
}
