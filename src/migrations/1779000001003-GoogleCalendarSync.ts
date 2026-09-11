import { MigrationInterface, QueryRunner } from 'typeorm';

export class GoogleCalendarSync1779000001003 implements MigrationInterface {
    name = 'GoogleCalendarSync1779000001003';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS google_calendar_connection (
                id serial CONSTRAINT "PK_google_calendar_connection" PRIMARY KEY,
                "userId" integer NOT NULL REFERENCES "user"(id),
                "calendarId" character varying DEFAULT 'primary' NOT NULL,
                "accessToken" text NOT NULL,
                "refreshToken" text,
                "tokenExpiresAt" TIMESTAMP,
                "syncEnabled" boolean DEFAULT true NOT NULL,
                "createdAt" TIMESTAMP DEFAULT now() NOT NULL,
                "updatedAt" TIMESTAMP DEFAULT now() NOT NULL
            );
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS calendar_external_event (
                id serial CONSTRAINT "PK_calendar_external_event" PRIMARY KEY,
                "occurrenceId" integer NOT NULL REFERENCES calendar_occurrence(id),
                "userId" integer NOT NULL REFERENCES "user"(id),
                provider character varying DEFAULT 'GOOGLE' NOT NULL,
                "externalEventId" character varying NOT NULL,
                "externalUpdatedAt" TIMESTAMP,
                "lastSyncedAt" TIMESTAMP,
                "createdAt" TIMESTAMP DEFAULT now() NOT NULL,
                "updatedAt" TIMESTAMP DEFAULT now() NOT NULL
            );
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_google_calendar_connection_user"
            ON google_calendar_connection ("userId", "calendarId");
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_calendar_external_event_unique"
            ON calendar_external_event ("occurrenceId", "userId", provider);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_calendar_external_event_unique";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_google_calendar_connection_user";`);
        await queryRunner.query(`DROP TABLE IF EXISTS calendar_external_event;`);
        await queryRunner.query(`DROP TABLE IF EXISTS google_calendar_connection;`);
    }
}
