import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTargetUserIdToAssessment1776898517000 implements MigrationInterface {
    name = 'AddTargetUserIdToAssessment1776898517000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Hacer patientId nullable si no lo es
        await queryRunner.query(`
            ALTER TABLE "assessment" 
            ALTER COLUMN "patientId" DROP NOT NULL;
        `);

        // Agregar columna targetUserId
        await queryRunner.query(`
            ALTER TABLE "assessment" 
            ADD COLUMN "targetUserId" integer NULL;
        `);

        // Crear índice para optimizar consultas
        await queryRunner.query(`
            CREATE INDEX "IDX_assessment_targetUserId" ON "assessment"("targetUserId");
        `);

        // Crear FK a la tabla user
        await queryRunner.query(`
            ALTER TABLE "assessment" 
            ADD CONSTRAINT "FK_assessment_targetUser" 
            FOREIGN KEY ("targetUserId") 
            REFERENCES "user"(id) 
            ON DELETE SET NULL;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "assessment" DROP CONSTRAINT IF EXISTS "FK_assessment_targetUser";
        `);

        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_assessment_targetUserId";
        `);

        await queryRunner.query(`
            ALTER TABLE "assessment" DROP COLUMN IF EXISTS "targetUserId";
        `);

        // Restaurar NOT NULL en patientId (si era el estado original)
        // Nota: esto puede fallar si hay registros con patientId NULL
        await queryRunner.query(`
            ALTER TABLE "assessment" 
            ALTER COLUMN "patientId" SET NOT NULL;
        `);
    }
}
