import { MigrationInterface, QueryRunner } from 'typeorm';

export class RandomizationRules1779000001008 implements MigrationInterface {
    name = 'RandomizationRules1779000001008';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "randomization_rule_type_enum" AS ENUM ('LOW_LEVEL', 'HIGH_LEVEL');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "randomization_rule_item_itemType_enum" AS ENUM ('QUESTIONNAIRE', 'QUESTIONNAIRE_BUNDLE', 'EVALUATION_SCHEME');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS randomization_rule (
                id serial CONSTRAINT "PK_randomization_rule" PRIMARY KEY,
                name varchar NOT NULL,
                type "randomization_rule_type_enum" NOT NULL,
                active boolean DEFAULT true NOT NULL,
                "createdAt" timestamp DEFAULT now() NOT NULL,
                "updatedAt" timestamp DEFAULT now() NOT NULL
            );
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS randomization_rule_item (
                id serial CONSTRAINT "PK_randomization_rule_item" PRIMARY KEY,
                "randomizationRuleId" integer NOT NULL
                    CONSTRAINT "FK_randomization_rule_item_rule"
                    REFERENCES randomization_rule(id) ON DELETE CASCADE,
                "itemType" "randomization_rule_item_itemType_enum" NOT NULL,
                "questionnaireId" varchar,
                "questionnaireBundleId" varchar,
                "evaluationSchemeId" integer,
                weight double precision NOT NULL,
                position integer NOT NULL,
                "createdAt" timestamp DEFAULT now() NOT NULL,
                "updatedAt" timestamp DEFAULT now() NOT NULL,
                CONSTRAINT "CHK_randomization_rule_item_weight_positive"
                    CHECK (weight > 0),
                CONSTRAINT "CHK_randomization_rule_item_reference_shape"
                    CHECK (
                        (
                            "itemType" = 'QUESTIONNAIRE'
                            AND "questionnaireId" IS NOT NULL
                            AND "questionnaireBundleId" IS NULL
                            AND "evaluationSchemeId" IS NULL
                        )
                        OR (
                            "itemType" = 'QUESTIONNAIRE_BUNDLE'
                            AND "questionnaireId" IS NULL
                            AND "questionnaireBundleId" IS NOT NULL
                            AND "evaluationSchemeId" IS NULL
                        )
                        OR (
                            "itemType" = 'EVALUATION_SCHEME'
                            AND "questionnaireId" IS NULL
                            AND "questionnaireBundleId" IS NULL
                            AND "evaluationSchemeId" IS NOT NULL
                        )
                    )
            );
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS randomization_rule_department (
                "randomizationRuleId" integer NOT NULL
                    CONSTRAINT "FK_randomization_rule_department_rule"
                    REFERENCES randomization_rule(id) ON DELETE CASCADE,
                "departmentId" integer NOT NULL
                    CONSTRAINT "FK_randomization_rule_department_department"
                    REFERENCES department(id) ON DELETE CASCADE,
                CONSTRAINT "PK_randomization_rule_department"
                    PRIMARY KEY ("randomizationRuleId", "departmentId")
            );
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_randomization_rule_item_rule"
            ON randomization_rule_item ("randomizationRuleId");
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_randomization_rule_department_department"
            ON randomization_rule_department ("departmentId");
        `);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_randomization_rule_department_department";
        `);
        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_randomization_rule_item_rule";
        `);
        await queryRunner.query(`
            DROP TABLE IF EXISTS randomization_rule_department;
        `);
        await queryRunner.query(`
            DROP TABLE IF EXISTS randomization_rule_item;
        `);
        await queryRunner.query(`
            DROP TABLE IF EXISTS randomization_rule;
        `);
        await queryRunner.query(`
            DROP TYPE IF EXISTS "randomization_rule_item_itemType_enum";
        `);
        await queryRunner.query(`
            DROP TYPE IF EXISTS "randomization_rule_type_enum";
        `);
    }
}
