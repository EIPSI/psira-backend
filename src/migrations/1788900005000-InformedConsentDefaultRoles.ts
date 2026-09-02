import { MigrationInterface, QueryRunner } from 'typeorm';

export class InformedConsentDefaultRoles1788900005000 implements MigrationInterface {
    name = 'InformedConsentDefaultRoles1788900005000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "informed_consent_model"
            SET "systemDefault" = false
            WHERE "systemDefault" = true
        `);

        await queryRunner.query(`
            UPDATE "informed_consent_management"
            SET "appliesToAllRoles" = false
            WHERE "scopeHash" IN (
                'terms:first-login:all',
                'terms:version-changed:all',
                'treatment:first-login:patient',
                'treatment:new-treatment:patient',
                'treatment:version-changed:patient',
                'research-general:first-login:non-patient',
                'research-general:version-changed:non-patient',
                'research-clinical:first-login:patient',
                'research-clinical:new-treatment:patient',
                'research-clinical:version-changed:patient'
            )
        `);

        await queryRunner.query(`
            INSERT INTO "informed_consent_management_role" ("managementId", "roleId")
            SELECT management.id, role.id
            FROM "informed_consent_management" management
            CROSS JOIN role
            WHERE management."scopeHash" IN ('terms:first-login:all', 'terms:version-changed:all')
              AND role.code <> 'SUPER_ADMIN'
            ON CONFLICT ("managementId", "roleId") DO NOTHING
        `);

        await queryRunner.query(`
            INSERT INTO "informed_consent_management_role" ("managementId", "roleId")
            SELECT management.id, role.id
            FROM "informed_consent_management" management
            CROSS JOIN role
            WHERE management."scopeHash" IN (
                'research-general:first-login:non-patient',
                'research-general:version-changed:non-patient'
            )
              AND role.code NOT IN ('PATIENT', 'SUPER_ADMIN')
            ON CONFLICT ("managementId", "roleId") DO NOTHING
        `);

        await queryRunner.query(`
            DELETE FROM "informed_consent_management_role" link
            USING role
            WHERE link."roleId" = role.id
              AND role.code = 'SUPER_ADMIN'
        `);
    }

    public async down(): Promise<void> {
        return undefined;
    }
}
