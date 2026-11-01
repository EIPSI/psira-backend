import { MigrationInterface, QueryRunner } from 'typeorm';

export class ResearchRolesAndClinicalDepartmentSettings1793318400000 implements MigrationInterface {
    async up(q: QueryRunner): Promise<void> {
        await q.query(`ALTER TABLE report ADD COLUMN "departmentIds" text`);
        await q.query(`INSERT INTO role(name, code, hierarchy, "createdAt", "updatedAt") VALUES
            ('Research Administrator','RESEARCH_ADMIN',100,now(),now()), ('Project Researcher','PROJECT_RESEARCHER',200,now(),now())
            ON CONFLICT(code) DO NOTHING`);
        await q.query(`UPDATE department SET "appliedRoleCodes"=concat_ws(',',nullif("appliedRoleCodes",''),'RESEARCH_ADMIN','PROJECT_RESEARCHER')
            WHERE "appliedRoleCodes" IS NOT NULL AND "appliedRoleCodes"<>''`);
        await q.query(`ALTER TABLE clinical_session_follow_up_setting ADD COLUMN "departmentId" integer UNIQUE REFERENCES department(id) ON DELETE CASCADE,
            ADD COLUMN "patientCaseManagerRoleCodes" text, ADD COLUMN "therapistSupervisorRoleCodes" text`);
        await q.query(`INSERT INTO clinical_session_follow_up_setting(id,"editWindowDays","dashboardLookaheadDays","updatedAt")
            VALUES(1,7,1,now()) ON CONFLICT(id) DO NOTHING`);
        await q.query(`INSERT INTO notification_configuration
            ("departmentId",channel,family,event,"recipientRoleId","mailTemplateId",active,notes,"createdAt","updatedAt")
            SELECT DISTINCT ON (target.id,source."departmentId",source.channel,source.event)
                source."departmentId",source.channel,source.family,source.event,target.id,source."mailTemplateId",source.active,
                'Research role notification defaults',now(),now()
            FROM notification_configuration source JOIN role original ON original.id=source."recipientRoleId"
            CROSS JOIN role target WHERE target.code IN ('RESEARCH_ADMIN','PROJECT_RESEARCHER')
                AND original.code NOT IN ('RESEARCH_ADMIN','PROJECT_RESEARCHER')
                AND source.event::text IN ('USER_CREATED','INFORMED_CONSENT_PENDING','INFORMED_CONSENT_SUBMITTED',
                    'INFORMED_CONSENT_REJECTED','INFORMED_CONSENT_REACTIVATED')
                AND NOT EXISTS(SELECT 1 FROM notification_configuration existing WHERE existing."recipientRoleId"=target.id
                    AND existing.channel=source.channel AND existing.event=source.event
                    AND existing."departmentId" IS NOT DISTINCT FROM source."departmentId")
            ORDER BY target.id,source."departmentId",source.channel,source.event,
                CASE WHEN original.code=CASE target.code WHEN 'RESEARCH_ADMIN' THEN 'SUPER_ADMIN' ELSE 'DEPARTMENT_ADMIN' END
                    THEN 0 ELSE 1 END,source.id`);
        await q.query(`SELECT setval(pg_get_serial_sequence('clinical_session_follow_up_setting','id'),
            (SELECT max(id) FROM clinical_session_follow_up_setting))`);
    }
    async down(q: QueryRunner): Promise<void> {
        await q.query(`ALTER TABLE report DROP COLUMN "departmentIds"`);
        await q.query(`ALTER TABLE clinical_session_follow_up_setting DROP COLUMN "departmentId", DROP COLUMN "patientCaseManagerRoleCodes", DROP COLUMN "therapistSupervisorRoleCodes"`);
        // Accounts and their roles are intentionally retained on rollback.
    }
}
