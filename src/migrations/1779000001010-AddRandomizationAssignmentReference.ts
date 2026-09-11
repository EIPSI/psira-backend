import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRandomizationAssignmentReference1779000001010 implements MigrationInterface {
    name = 'AddRandomizationAssignmentReference1779000001010';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE "evaluation_scheme_assignment" ADD "randomizationRuleId" integer',
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE "evaluation_scheme_assignment" DROP COLUMN "randomizationRuleId"',
        );
    }
}
