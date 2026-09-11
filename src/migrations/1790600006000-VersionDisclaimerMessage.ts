import { MigrationInterface, QueryRunner } from 'typeorm';

export class VersionDisclaimerMessage1790600006000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO disclaimer (type, description)
            VALUES ('versionMessage', '<h3>Version {{version}}</h3>')
            ON CONFLICT (type) DO NOTHING
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM disclaimer WHERE type = 'versionMessage'`);
    }
}
