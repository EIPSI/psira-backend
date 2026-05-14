import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserIdToCaregiver1777593000000 implements MigrationInterface {
    name = 'AddUserIdToCaregiver1777593000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "caregiver"
            ADD COLUMN "userId" integer NULL;

            CREATE INDEX "IDX_caregiver_userId" ON "caregiver"("userId");

            ALTER TABLE "caregiver"
            ADD CONSTRAINT "FK_caregiver_user"
            FOREIGN KEY ("userId")
            REFERENCES "user"(id)
            ON DELETE SET NULL;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "caregiver" DROP CONSTRAINT IF EXISTS "FK_caregiver_user";

            DROP INDEX IF EXISTS "IDX_caregiver_userId";

            ALTER TABLE "caregiver" DROP COLUMN IF EXISTS "userId";
        `);
    }
}
