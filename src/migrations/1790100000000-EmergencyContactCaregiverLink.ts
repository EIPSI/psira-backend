import { MigrationInterface, QueryRunner } from "typeorm";

export class EmergencyContactCaregiverLink1790100000000 implements MigrationInterface {
    name = 'EmergencyContactCaregiverLink1790100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "emergency_contact" ADD "caregiverId" integer`);
        await queryRunner.query(`ALTER TABLE "emergency_contact" ADD CONSTRAINT "FK_emergency_contact_caregiver" FOREIGN KEY ("caregiverId") REFERENCES "caregiver"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "emergency_contact" DROP CONSTRAINT "FK_emergency_contact_caregiver"`);
        await queryRunner.query(`ALTER TABLE "emergency_contact" DROP COLUMN "caregiverId"`);
    }
}
