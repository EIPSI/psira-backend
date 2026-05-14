import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResponderUserToAssessment1777593003000 implements MigrationInterface {
    name = 'AddResponderUserToAssessment1777593003000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "assessment" ADD "responderUserId" integer`);
        await queryRunner.query(`
            ALTER TABLE "assessment"
            ADD CONSTRAINT "FK_assessment_responder_user"
            FOREIGN KEY ("responderUserId") REFERENCES "user"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`UPDATE "assessment" SET "responderUserId" = "targetUserId" WHERE "responderUserId" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "assessment" DROP CONSTRAINT "FK_assessment_responder_user"`);
        await queryRunner.query(`ALTER TABLE "assessment" DROP COLUMN "responderUserId"`);
    }
}
