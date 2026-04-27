import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReportSessions1776350000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            create table IF NOT EXISTS report_session
            (
                id                serial
                    constraint "PK_report_session"
                    primary key,
                "reportId"       integer                 not null
                    constraint "FK_report_session_report"
                    references report,
                "userId"         integer                 not null
                    constraint "FK_report_session_user"
                    references "user",
                "patientId"      integer,
                "startedAt"      timestamp               not null,
                "lastSeenAt"     timestamp               not null,
                "endedAt"        timestamp,
                "durationSeconds" integer default 0      not null,
                active            boolean default true    not null,
                "createdAt"      timestamp default now() not null,
                "updatedAt"      timestamp default now() not null
            );
        `);

        await queryRunner.query(`
            create index IF NOT EXISTS "IDX_report_session_report"
            on report_session ("reportId");
        `);

        await queryRunner.query(`
            create index IF NOT EXISTS "IDX_report_session_user"
            on report_session ("userId");
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`drop table IF EXISTS report_session;`);
    }
}
