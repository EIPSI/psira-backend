import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationPreferenceUserScopeRepair1787900000000 implements MigrationInterface {
    name = 'NotificationPreferenceUserScopeRepair1787900000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification_preference" ADD COLUMN IF NOT EXISTS "userId" integer`);
        await queryRunner.query(`ALTER TABLE "notification_preference" DROP CONSTRAINT IF EXISTS "CHK_notification_preference_scope"`);
        await queryRunner.query(`
            ALTER TABLE "notification_preference"
            ADD CONSTRAINT "CHK_notification_preference_scope" CHECK (
                (
                    CASE WHEN "patientId" IS NULL THEN 0 ELSE 1 END
                    + CASE WHEN "therapistId" IS NULL THEN 0 ELSE 1 END
                    + CASE WHEN "userId" IS NULL THEN 0 ELSE 1 END
                ) = 1
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "UQ_notification_preference_user"
            ON "notification_preference" ("userId")
            WHERE "userId" IS NOT NULL
        `);
        await queryRunner.query(`
            DO $$
            BEGIN
                ALTER TABLE "notification_preference"
                ADD CONSTRAINT "FK_notification_preference_user"
                FOREIGN KEY ("userId") REFERENCES "user"("id")
                ON DELETE CASCADE ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN
                NULL;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification_preference" DROP CONSTRAINT IF EXISTS "FK_notification_preference_user"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_notification_preference_user"`);
        await queryRunner.query(`ALTER TABLE "notification_preference" DROP CONSTRAINT IF EXISTS "CHK_notification_preference_scope"`);
        await queryRunner.query(`
            ALTER TABLE "notification_preference"
            ADD CONSTRAINT "CHK_notification_preference_scope" CHECK (
                ("patientId" IS NOT NULL AND "therapistId" IS NULL)
                OR ("patientId" IS NULL AND "therapistId" IS NOT NULL)
            )
        `);
    }
}
