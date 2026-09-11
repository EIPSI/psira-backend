import { MigrationInterface, QueryRunner } from 'typeorm';

export class MailTemplateSenderName1789600000000 implements MigrationInterface {
    name = 'MailTemplateSenderName1789600000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE mail_template
            ADD COLUMN IF NOT EXISTS "senderName" character varying;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE mail_template
            DROP COLUMN IF EXISTS "senderName";
        `);
    }
}
