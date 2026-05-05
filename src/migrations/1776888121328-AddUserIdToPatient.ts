import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserIdToPatient1776888121328 implements MigrationInterface {
    name = 'AddUserIdToPatient1776888121328';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "patient" 
            ADD COLUMN "userId" integer NULL;
            
            CREATE INDEX "IDX_patient_userId" ON "patient"("userId");
            
            ALTER TABLE "patient" 
            ADD CONSTRAINT "FK_patient_user" 
            FOREIGN KEY ("userId") 
            REFERENCES "user"(id) 
            ON DELETE SET NULL;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "patient" DROP CONSTRAINT IF EXISTS "FK_patient_user";
            
            DROP INDEX IF EXISTS "IDX_patient_userId";
            
            ALTER TABLE "patient" DROP COLUMN IF EXISTS "userId";
        `);
    }
}
