import { MigrationInterface, QueryRunner } from "typeorm";

export class DepartmentRoleApplicability1790200000000 implements MigrationInterface {
    name = 'DepartmentRoleApplicability1790200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const allRoles = 'SUPER_ADMIN,SUPERVISOR,DEPARTMENT_ADMIN,THERAPIST,CAREGIVER,PATIENT,NO_ROLE';
        await queryRunner.query(`ALTER TABLE "department" ADD "appliedRoleCodes" text`);
        await queryRunner.query(`ALTER TABLE "department" ADD "defaultRoleCodes" text`);
        await queryRunner.query(`UPDATE "department" SET "appliedRoleCodes" = $1 WHERE "appliedRoleCodes" IS NULL`, [allRoles]);
        await queryRunner.query(`UPDATE "department" SET "defaultRoleCodes" = $1 WHERE "name" = $2`, ['THERAPIST,SUPERVISOR', 'Particular']);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "department" DROP COLUMN "defaultRoleCodes"`);
        await queryRunner.query(`ALTER TABLE "department" DROP COLUMN "appliedRoleCodes"`);
    }
}
