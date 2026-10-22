import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClinicalIdentityAndEvaluationScope1792700000000 implements MigrationInterface {
    name = 'ClinicalIdentityAndEvaluationScope1792700000000';
    async up(q: QueryRunner): Promise<void> {
        for (const table of ['assessment', 'evaluation_scheme_assignment']) {
            await q.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "departmentIds" text NULL,
                ADD COLUMN IF NOT EXISTS "automationId" integer NULL`);
        }
        // Clinical profiles are authoritative for existing linked records. Credentials, roles and flags are untouched.
        await q.query(`UPDATE "user" u SET "firstName"=p."firstName", "middleName"=p."middleName", "lastName"=p."lastName",
            email=p.email, phone=p.phone, gender=p.gender, "birthDate"=p."birthDate", nationality=p.nationality, address=p.address
            FROM patient p WHERE p."userId"=u.id AND p."deletedAt" IS NULL AND u."deletedAt" IS NULL`);
        await q.query(`UPDATE "user" u SET "firstName"=c."firstName", "middleName"=c."middleName", "lastName"=c."lastName", email=c.email, phone=c.phone
            FROM caregiver c WHERE c."userId"=u.id AND c."deletedAt" IS NULL AND u."deletedAt" IS NULL
            AND NOT EXISTS(SELECT 1 FROM patient p WHERE p."userId"=u.id AND p."deletedAt" IS NULL)`);
        await q.query(`DELETE FROM user_department ud USING patient p WHERE p."userId"=ud."userId" AND p."deletedAt" IS NULL
            AND NOT EXISTS(SELECT 1 FROM patient_department pd WHERE pd."patientId"=p.id AND pd."departmentId"=ud."departmentId")`);
        await q.query(`INSERT INTO user_department("userId","departmentId") SELECT p."userId",pd."departmentId"
            FROM patient p JOIN patient_department pd ON pd."patientId"=p.id WHERE p."userId" IS NOT NULL AND p."deletedAt" IS NULL ON CONFLICT DO NOTHING`);
        await q.query(`CREATE OR REPLACE FUNCTION psira_sync_clinical_identity() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF pg_trigger_depth()>2 THEN RETURN NEW; END IF;
            IF TG_TABLE_NAME='patient' AND (to_jsonb(NEW)->>'userId') IS NOT NULL AND NEW."deletedAt" IS NULL THEN
                UPDATE "user" SET "firstName"=NEW."firstName", "middleName"=NEW."middleName", "lastName"=NEW."lastName", email=NEW.email,
                    phone=NEW.phone, gender=NEW.gender, "birthDate"=NEW."birthDate", nationality=NEW.nationality, address=NEW.address
                    WHERE id=NEW."userId" AND "deletedAt" IS NULL AND ROW("firstName","middleName","lastName",email,phone,gender,"birthDate",nationality,address)
                    IS DISTINCT FROM ROW(NEW."firstName",NEW."middleName",NEW."lastName",NEW.email,NEW.phone,NEW.gender,NEW."birthDate",NEW.nationality,NEW.address);
            ELSIF TG_TABLE_NAME='caregiver' AND (to_jsonb(NEW)->>'userId') IS NOT NULL AND NEW."deletedAt" IS NULL THEN
                UPDATE "user" SET "firstName"=NEW."firstName", "middleName"=NEW."middleName", "lastName"=NEW."lastName", email=NEW.email, phone=NEW.phone
                    WHERE id=NEW."userId" AND "deletedAt" IS NULL AND ROW("firstName","middleName","lastName",email,phone)
                    IS DISTINCT FROM ROW(NEW."firstName",NEW."middleName",NEW."lastName",NEW.email,NEW.phone);
            ELSIF TG_TABLE_NAME='user' AND NEW."deletedAt" IS NULL THEN
                UPDATE patient SET "firstName"=NEW."firstName", "middleName"=NEW."middleName", "lastName"=NEW."lastName", email=NEW.email,
                    phone=NEW.phone, gender=NEW.gender, "birthDate"=NEW."birthDate", nationality=NEW.nationality, address=NEW.address
                    WHERE "userId"=NEW.id AND "deletedAt" IS NULL AND ROW("firstName","middleName","lastName",email,phone,gender,"birthDate",nationality,address)
                    IS DISTINCT FROM ROW(NEW."firstName",NEW."middleName",NEW."lastName",NEW.email,NEW.phone,NEW.gender,NEW."birthDate",NEW.nationality,NEW.address);
                UPDATE caregiver SET "firstName"=NEW."firstName", "middleName"=NEW."middleName", "lastName"=NEW."lastName", email=NEW.email, phone=NEW.phone
                    WHERE "userId"=NEW.id AND "deletedAt" IS NULL AND ROW("firstName","middleName","lastName",email,phone)
                    IS DISTINCT FROM ROW(NEW."firstName",NEW."middleName",NEW."lastName",NEW.email,NEW.phone);
            END IF;
            RETURN NEW;
        END $$`);
        for (const table of ['user', 'patient', 'caregiver']) {
            const extra = table === 'caregiver' ? '' : ',gender,"birthDate",nationality,address';
            const link = table === 'user' ? '' : ',"userId"';
            await q.query(`CREATE TRIGGER psira_identity_${table} AFTER INSERT OR UPDATE OF "firstName","middleName","lastName",email,phone${extra}${link}
                ON "${table}" FOR EACH ROW EXECUTE FUNCTION psira_sync_clinical_identity()`);
        }
        await q.query(`CREATE OR REPLACE FUNCTION psira_sync_caregiver_departments(cid integer) RETURNS void LANGUAGE plpgsql AS $$
        DECLARE uid integer;
        BEGIN
            SELECT "userId" INTO uid FROM caregiver WHERE id=cid AND "deletedAt" IS NULL;
            IF uid IS NULL OR EXISTS(SELECT 1 FROM patient WHERE "userId"=uid AND "deletedAt" IS NULL) THEN RETURN; END IF;
            DELETE FROM user_department ud WHERE ud."userId"=uid AND NOT EXISTS(
                SELECT 1 FROM patient_caregiver pc JOIN patient p ON p.id=pc."patientId" JOIN patient_department pd ON pd."patientId"=p.id
                WHERE pc."caregiverId"=cid AND pc."deletedAt" IS NULL AND p."deletedAt" IS NULL AND pd."departmentId"=ud."departmentId");
            INSERT INTO user_department("userId","departmentId") SELECT DISTINCT uid,pd."departmentId"
                FROM patient_caregiver pc JOIN patient p ON p.id=pc."patientId" JOIN patient_department pd ON pd."patientId"=p.id
                WHERE pc."caregiverId"=cid AND pc."deletedAt" IS NULL AND p."deletedAt" IS NULL ON CONFLICT DO NOTHING;
        END $$`);
        await q.query(`CREATE OR REPLACE FUNCTION psira_sync_departments() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE uid integer; pid integer; cid integer;
        BEGIN
            IF pg_trigger_depth()>1 THEN RETURN COALESCE(NEW,OLD); END IF;
            IF TG_TABLE_NAME='user_department' THEN
                uid=COALESCE(NEW."userId",OLD."userId");
                SELECT id INTO pid FROM patient WHERE "userId"=uid AND "deletedAt" IS NULL;
                IF pid IS NOT NULL THEN
                    DELETE FROM patient_department pd WHERE pd."patientId"=pid AND NOT EXISTS(SELECT 1 FROM user_department ud WHERE ud."userId"=uid AND ud."departmentId"=pd."departmentId");
                    INSERT INTO patient_department("patientId","departmentId") SELECT pid,"departmentId" FROM user_department WHERE "userId"=uid ON CONFLICT DO NOTHING;
                END IF;
            ELSE
                pid=COALESCE(NEW."patientId",OLD."patientId");
                SELECT "userId" INTO uid FROM patient WHERE id=pid AND "deletedAt" IS NULL;
                IF uid IS NOT NULL THEN
                    DELETE FROM user_department ud WHERE ud."userId"=uid AND NOT EXISTS(SELECT 1 FROM patient_department pd WHERE pd."patientId"=pid AND pd."departmentId"=ud."departmentId");
                    INSERT INTO user_department("userId","departmentId") SELECT uid,"departmentId" FROM patient_department WHERE "patientId"=pid ON CONFLICT DO NOTHING;
                END IF;
            END IF;
            IF pid IS NULL AND uid IS NOT NULL THEN
                FOR cid IN SELECT id FROM caregiver WHERE "userId"=uid AND "deletedAt" IS NULL LOOP
                    PERFORM psira_sync_caregiver_departments(cid);
                END LOOP;
            END IF;
            FOR cid IN SELECT "caregiverId" FROM patient_caregiver WHERE "patientId"=pid AND "deletedAt" IS NULL LOOP
                PERFORM psira_sync_caregiver_departments(cid);
            END LOOP;
            RETURN COALESCE(NEW,OLD);
        END $$`);
        for (const table of ['user_department', 'patient_department']) {
            await q.query(`CREATE TRIGGER psira_departments_${table} AFTER INSERT OR UPDATE OR DELETE ON "${table}"
                FOR EACH ROW EXECUTE FUNCTION psira_sync_departments()`);
        }
        await q.query(`CREATE OR REPLACE FUNCTION psira_sync_caregiver_link() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF pg_trigger_depth()>1 THEN RETURN COALESCE(NEW,OLD); END IF;
            IF TG_TABLE_NAME='caregiver' THEN PERFORM psira_sync_caregiver_departments(NEW.id);
            ELSE
                IF TG_OP<>'INSERT' THEN PERFORM psira_sync_caregiver_departments(OLD."caregiverId"); END IF;
                IF TG_OP<>'DELETE' THEN PERFORM psira_sync_caregiver_departments(NEW."caregiverId"); END IF;
            END IF;
            RETURN COALESCE(NEW,OLD);
        END $$`);
        await q.query(`CREATE TRIGGER psira_caregiver_link AFTER INSERT OR UPDATE OR DELETE ON patient_caregiver FOR EACH ROW EXECUTE FUNCTION psira_sync_caregiver_link()`);
        await q.query(`CREATE TRIGGER psira_caregiver_user AFTER UPDATE OF "userId" ON caregiver FOR EACH ROW EXECUTE FUNCTION psira_sync_caregiver_link()`);
        await q.query(`SELECT psira_sync_caregiver_departments(id) FROM caregiver WHERE "userId" IS NOT NULL AND "deletedAt" IS NULL`);
        // Preserve automation provenance for existing evaluations and fixed-scheme assignments.
        await q.query(`UPDATE assessment a SET "automationId"=r."automationId" FROM evaluation_automation_run r
            WHERE r."resourceType"::text='ASSESSMENT' AND r."resourceId"::text=a.id::text AND r."automationId" IS NOT NULL`);
        await q.query(`UPDATE evaluation_scheme_assignment s SET "automationId"=r."automationId" FROM evaluation_automation_run r
            WHERE r."resourceType"::text='EVALUATION_SCHEME_ASSIGNMENT' AND r."resourceId"::text=s.id::text AND r."automationId" IS NOT NULL`);
        for (const table of ['assessment', 'evaluation_scheme_assignment']) {
            await q.query(`UPDATE "${table}" a SET "departmentIds"=COALESCE((SELECT json_agg(ud."departmentId")::text
                FROM user_department ud WHERE ud."userId"=COALESCE(a."targetUserId",(SELECT "userId" FROM patient WHERE id=a."patientId"),${table === 'assessment' ? 'a."responderUserId"' : 'a."responderUserId"'})
                AND (a."automationId" IS NULL OR NOT EXISTS(SELECT 1 FROM evaluation_automation_department WHERE "automationId"=a."automationId")
                    OR EXISTS(SELECT 1 FROM evaluation_automation_department d WHERE d."automationId"=a."automationId" AND d."departmentId"=ud."departmentId"))), '[]')`);
        }
        await q.query(`UPDATE assessment a SET "automationId"=s."automationId", "departmentIds"=s."departmentIds"
            FROM evaluation_scheme_assignment s WHERE a."schemeAssignmentId"=s.id AND s."automationId" IS NOT NULL`);
    }
    async down(q: QueryRunner): Promise<void> {
        await q.query('DROP TRIGGER IF EXISTS psira_caregiver_link ON patient_caregiver');
        await q.query('DROP TRIGGER IF EXISTS psira_caregiver_user ON caregiver');
        for (const table of ['user_department', 'patient_department']) await q.query(`DROP TRIGGER IF EXISTS psira_departments_${table} ON "${table}"`);
        for (const table of ['user', 'patient', 'caregiver']) await q.query(`DROP TRIGGER IF EXISTS psira_identity_${table} ON "${table}"`);
        for (const name of ['psira_sync_caregiver_link()', 'psira_sync_departments()', 'psira_sync_clinical_identity()', 'psira_sync_caregiver_departments(integer)']) {
            await q.query(`DROP FUNCTION IF EXISTS ${name}`);
        }
        for (const table of ['assessment', 'evaluation_scheme_assignment']) await q.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "departmentIds", DROP COLUMN IF EXISTS "automationId"`);
    }
}
