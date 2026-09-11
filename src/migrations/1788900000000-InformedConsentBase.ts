import { MigrationInterface, QueryRunner } from 'typeorm';

export class InformedConsentBase1788900000000 implements MigrationInterface {
    name = 'InformedConsentBase1788900000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "informed_consent_model" (
                "id" SERIAL NOT NULL,
                "name" varchar NOT NULL,
                "kind" varchar NOT NULL,
                "description" text,
                "active" boolean NOT NULL DEFAULT true,
                "systemDefault" boolean NOT NULL DEFAULT false,
                "currentPublishedVersionId" integer,
                "createdById" integer,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_informed_consent_model" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "informed_consent_version" (
                "id" SERIAL NOT NULL,
                "modelId" integer NOT NULL,
                "versionNumber" integer NOT NULL,
                "title" varchar NOT NULL,
                "status" varchar NOT NULL DEFAULT 'DRAFT',
                "notes" text,
                "publishedAt" TIMESTAMP,
                "createdById" integer,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_informed_consent_version" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_informed_consent_version_number" UNIQUE ("modelId", "versionNumber")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "informed_consent_text_block" (
                "id" SERIAL NOT NULL,
                "versionId" integer NOT NULL,
                "orderIndex" integer NOT NULL,
                "title" varchar,
                "content" text NOT NULL,
                CONSTRAINT "PK_informed_consent_text_block" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "informed_consent_question" (
                "id" SERIAL NOT NULL,
                "versionId" integer NOT NULL,
                "kind" varchar NOT NULL,
                "questionType" varchar NOT NULL,
                "orderIndex" integer NOT NULL,
                "label" text NOT NULL,
                "helpText" text,
                "required" boolean NOT NULL DEFAULT true,
                CONSTRAINT "PK_informed_consent_question" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "informed_consent_answer_option" (
                "id" SERIAL NOT NULL,
                "questionId" integer NOT NULL,
                "orderIndex" integer NOT NULL,
                "value" varchar NOT NULL,
                "label" text NOT NULL,
                "resolution" varchar NOT NULL,
                "blocksUsageOnSelection" boolean NOT NULL DEFAULT false,
                CONSTRAINT "PK_informed_consent_answer_option" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "informed_consent_management" (
                "id" SERIAL NOT NULL,
                "title" varchar NOT NULL,
                "description" text,
                "modelId" integer NOT NULL,
                "status" varchar NOT NULL DEFAULT 'DRAFT',
                "trigger" varchar NOT NULL,
                "mandatory" boolean NOT NULL DEFAULT true,
                "appliesToAllDepartments" boolean NOT NULL DEFAULT true,
                "appliesToAllRoles" boolean NOT NULL DEFAULT true,
                "profileConditions" jsonb,
                "scopeHash" varchar,
                "priority" integer NOT NULL DEFAULT 100,
                "active" boolean NOT NULL DEFAULT true,
                "createdById" integer,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_informed_consent_management" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "UQ_informed_consent_management_active_scope"
            ON "informed_consent_management" ("modelId", "trigger", "scopeHash")
            WHERE "status" = 'ACTIVE' AND "scopeHash" IS NOT NULL
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "informed_consent_response" (
                "id" SERIAL NOT NULL,
                "managementId" integer,
                "modelId" integer NOT NULL,
                "versionId" integer NOT NULL,
                "signerUserId" integer NOT NULL,
                "representedUserId" integer,
                "patientId" integer,
                "status" varchar NOT NULL DEFAULT 'PENDING',
                "finalResolution" varchar,
                "mandatorySnapshot" boolean NOT NULL DEFAULT false,
                "modelSnapshot" jsonb,
                "responseSnapshot" jsonb,
                "answeredAt" TIMESTAMP,
                "blockedAt" TIMESTAMP,
                "ipAddress" varchar,
                "userAgent" text,
                "language" varchar,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_informed_consent_response" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "informed_consent_response_answer" (
                "id" SERIAL NOT NULL,
                "responseId" integer NOT NULL,
                "questionId" integer NOT NULL,
                "answerOptionId" integer,
                "valueText" text,
                "valueJson" jsonb,
                "resolution" varchar,
                CONSTRAINT "PK_informed_consent_response_answer" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "informed_consent_review" (
                "id" SERIAL NOT NULL,
                "responseId" integer NOT NULL,
                "reviewerUserId" integer NOT NULL,
                "action" varchar NOT NULL,
                "reason" text NOT NULL,
                "comment" text,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_informed_consent_review" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "informed_consent_model_department" (
                "modelId" integer NOT NULL,
                "departmentId" integer NOT NULL,
                CONSTRAINT "PK_informed_consent_model_department" PRIMARY KEY ("modelId", "departmentId")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "informed_consent_management_department" (
                "managementId" integer NOT NULL,
                "departmentId" integer NOT NULL,
                CONSTRAINT "PK_informed_consent_management_department" PRIMARY KEY ("managementId", "departmentId")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "informed_consent_management_role" (
                "managementId" integer NOT NULL,
                "roleId" integer NOT NULL,
                CONSTRAINT "PK_informed_consent_management_role" PRIMARY KEY ("managementId", "roleId")
            )
        `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_informed_consent_version_model" ON "informed_consent_version" ("modelId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_informed_consent_management_model" ON "informed_consent_management" ("modelId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_informed_consent_response_signer" ON "informed_consent_response" ("signerUserId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_informed_consent_response_patient" ON "informed_consent_response" ("patientId")`);

        await queryRunner.query(`ALTER TABLE "informed_consent_model" ADD CONSTRAINT "FK_informed_consent_model_current_version" FOREIGN KEY ("currentPublishedVersionId") REFERENCES "informed_consent_version"("id") ON DELETE SET NULL`);
        await queryRunner.query(`ALTER TABLE "informed_consent_model" ADD CONSTRAINT "FK_informed_consent_model_created_by" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL`);
        await queryRunner.query(`ALTER TABLE "informed_consent_version" ADD CONSTRAINT "FK_informed_consent_version_model" FOREIGN KEY ("modelId") REFERENCES "informed_consent_model"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "informed_consent_version" ADD CONSTRAINT "FK_informed_consent_version_created_by" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL`);
        await queryRunner.query(`ALTER TABLE "informed_consent_text_block" ADD CONSTRAINT "FK_informed_consent_text_block_version" FOREIGN KEY ("versionId") REFERENCES "informed_consent_version"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "informed_consent_question" ADD CONSTRAINT "FK_informed_consent_question_version" FOREIGN KEY ("versionId") REFERENCES "informed_consent_version"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "informed_consent_answer_option" ADD CONSTRAINT "FK_informed_consent_answer_option_question" FOREIGN KEY ("questionId") REFERENCES "informed_consent_question"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "informed_consent_management" ADD CONSTRAINT "FK_informed_consent_management_model" FOREIGN KEY ("modelId") REFERENCES "informed_consent_model"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "informed_consent_management" ADD CONSTRAINT "FK_informed_consent_management_created_by" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL`);
        await queryRunner.query(`ALTER TABLE "informed_consent_response" ADD CONSTRAINT "FK_informed_consent_response_management" FOREIGN KEY ("managementId") REFERENCES "informed_consent_management"("id") ON DELETE SET NULL`);
        await queryRunner.query(`ALTER TABLE "informed_consent_response" ADD CONSTRAINT "FK_informed_consent_response_model" FOREIGN KEY ("modelId") REFERENCES "informed_consent_model"("id")`);
        await queryRunner.query(`ALTER TABLE "informed_consent_response" ADD CONSTRAINT "FK_informed_consent_response_version" FOREIGN KEY ("versionId") REFERENCES "informed_consent_version"("id")`);
        await queryRunner.query(`ALTER TABLE "informed_consent_response" ADD CONSTRAINT "FK_informed_consent_response_signer" FOREIGN KEY ("signerUserId") REFERENCES "user"("id")`);
        await queryRunner.query(`ALTER TABLE "informed_consent_response" ADD CONSTRAINT "FK_informed_consent_response_represented_user" FOREIGN KEY ("representedUserId") REFERENCES "user"("id") ON DELETE SET NULL`);
        await queryRunner.query(`ALTER TABLE "informed_consent_response" ADD CONSTRAINT "FK_informed_consent_response_patient" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE SET NULL`);
        await queryRunner.query(`ALTER TABLE "informed_consent_response_answer" ADD CONSTRAINT "FK_informed_consent_response_answer_response" FOREIGN KEY ("responseId") REFERENCES "informed_consent_response"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "informed_consent_response_answer" ADD CONSTRAINT "FK_informed_consent_response_answer_question" FOREIGN KEY ("questionId") REFERENCES "informed_consent_question"("id")`);
        await queryRunner.query(`ALTER TABLE "informed_consent_response_answer" ADD CONSTRAINT "FK_informed_consent_response_answer_option" FOREIGN KEY ("answerOptionId") REFERENCES "informed_consent_answer_option"("id") ON DELETE SET NULL`);
        await queryRunner.query(`ALTER TABLE "informed_consent_review" ADD CONSTRAINT "FK_informed_consent_review_response" FOREIGN KEY ("responseId") REFERENCES "informed_consent_response"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "informed_consent_review" ADD CONSTRAINT "FK_informed_consent_review_reviewer" FOREIGN KEY ("reviewerUserId") REFERENCES "user"("id")`);
        await queryRunner.query(`ALTER TABLE "informed_consent_model_department" ADD CONSTRAINT "FK_informed_consent_model_department_model" FOREIGN KEY ("modelId") REFERENCES "informed_consent_model"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "informed_consent_model_department" ADD CONSTRAINT "FK_informed_consent_model_department_department" FOREIGN KEY ("departmentId") REFERENCES "department"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "informed_consent_management_department" ADD CONSTRAINT "FK_informed_consent_management_department_management" FOREIGN KEY ("managementId") REFERENCES "informed_consent_management"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "informed_consent_management_department" ADD CONSTRAINT "FK_informed_consent_management_department_department" FOREIGN KEY ("departmentId") REFERENCES "department"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "informed_consent_management_role" ADD CONSTRAINT "FK_informed_consent_management_role_management" FOREIGN KEY ("managementId") REFERENCES "informed_consent_management"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "informed_consent_management_role" ADD CONSTRAINT "FK_informed_consent_management_role_role" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "informed_consent_management_role"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "informed_consent_management_department"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "informed_consent_model_department"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "informed_consent_review"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "informed_consent_response_answer"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "informed_consent_response"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "informed_consent_management"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "informed_consent_answer_option"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "informed_consent_question"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "informed_consent_text_block"`);
        await queryRunner.query(`ALTER TABLE "informed_consent_model" DROP CONSTRAINT IF EXISTS "FK_informed_consent_model_current_version"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "informed_consent_version"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "informed_consent_model"`);
    }
}
