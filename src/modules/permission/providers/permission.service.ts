import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { User } from 'src/modules/user/models/user.model';
import { Hash } from 'src/shared';
import { Any } from 'typeorm';
import { MAX_ROLE_HIERARCHY } from '../constants';
import { PermissionEnum, systemPermissions as PermissionsMaster } from '../enums/permission.enum';
import { RoleCode } from '../enums/role-code.enum';
import { Permission } from '../models/permission.model';
import { Role } from '../models/role.model';

@Injectable()
export class PermissionService implements OnModuleInit {
    private readonly logger = new Logger(PermissionService.name);

    async onModuleInit() {
        // Keep database permissions up-to-date
        await this.populatePermissionsInDB();
    }

    private async populatePermissionsInDB() {
        const dbPermissions = (await Permission.find()).map(
            permission => permission.name,
        );

        const systemPermissions: string[] = Object.keys(PermissionEnum).map(
            key => PermissionEnum[key],
        );

        const permissionsToDelete = dbPermissions.filter(
            e => !systemPermissions.includes(e),
        );
        const permissionsToCreate = systemPermissions.filter(
            e => !dbPermissions.includes(e),
        );

        if (permissionsToDelete.length > 0) {
            this.logger.log(
                'Prunning un-needed permissions: ' +
                permissionsToDelete.join(','),
            );

            await Permission.createQueryBuilder()
                .relation(Role, 'permissions')
                .of(await Role.find({ relations: ['permissions'] }))
                .remove(
                    await Permission.find({
                        where: { name: Any(permissionsToDelete) },
                    }),
                );

            await Permission.createQueryBuilder()
                .delete()
                .where({ name: Any(permissionsToDelete) })
                .execute();
        }

        if (permissionsToCreate.length > 0) {
            this.logger.log(
                'Adding missing permissions: ' + permissionsToCreate.join(','),
            );

            await Permission.createQueryBuilder()
                .insert()
                .into(Permission)
                .values(
                    PermissionsMaster
                        .filter(permission => permissionsToCreate.includes(permission.name))
                        .map(permission => {
                            return { name: permission.name, group: permission.group };
                        }),
                )
                .execute();
        }

        // Auto Create Super-admin role if not exists
        let superAdminRole = await Role.findOne({ code: RoleCode.SUPER_ADMIN });
        if (!superAdminRole) {
            this.logger.log(
                'Role Super Admin not found in DB. System seeding it',
            );

            superAdminRole = new Role();
            superAdminRole.name = 'Super Admin';
            superAdminRole.code = RoleCode.SUPER_ADMIN;
            superAdminRole.hierarchy = MAX_ROLE_HIERARCHY;
            await superAdminRole.save();
        }

        // Assign all permissions to Super Admin
        const allPermissions = await Permission.find();
        superAdminRole.permissions = allPermissions;
        await superAdminRole.save();

        await this.assignDefaultSystemRolePermissions(allPermissions);

        // Refetch super admin role from DB with its users
        superAdminRole = await Role.findOne({
            where: { code: RoleCode.SUPER_ADMIN },
            relations: ['users'],
        });

        // Seed generic super admin user if non exists
        if (superAdminRole.users.length === 0) {
            this.logger.log(
                'No Super Admin found in DB. System seeding a generic super admin: user: admin, first time password: admin',
            );

            const configSuperAdminPassword = !!process.env.SUPERADMIN_PASSWORD ? String(process.env.SUPERADMIN_PASSWORD) : null;
            const configSuperAdminUsername = !!process.env.SUPERADMIN_USERNAME ? String(process.env.SUPERADMIN_USERNAME) : null;

            const password = configSuperAdminPassword?.length ? configSuperAdminPassword : 'superadmin';
            const username = configSuperAdminUsername?.length ? configSuperAdminUsername : 'superadmin';

            const superAdminUser = new User();
            superAdminUser.firstName = 'Super';
            superAdminUser.lastName = 'Admin';
            superAdminUser.username = username;
            superAdminUser.password = await Hash.make(password);
            superAdminUser.isSuperUser = true;
            superAdminUser.roles = [superAdminRole];

            this.logger.verbose(`User ${username} created with default password=${password}`);

            await superAdminUser.save();
        }
    }

    static async userPermissionGrants(userId: number): Promise<Permission[]> {
        // re-select the user
        const user = await User.findOne({
            relations: ['permissions', 'roles'],
            where: { id: userId },
        });

        const directPermissions = user.permissions;

        const roleIds = user.roles.map(role => role.id);

        const roles = await Role.find({
            relations: ['permissions'],
            where: { id: Any(roleIds) },
        });

        const rolePermissions = [] as Permission[];
        roles.forEach(role => {
            rolePermissions.push(...role.permissions);
        });

        const grantsByName = new Map<string, Permission>();
        [...directPermissions, ...rolePermissions].forEach(permission => {
            if (permission?.name) {
                grantsByName.set(permission.name, permission);
            }
        });

        return [...grantsByName.values()];
    }

    static async userCan(userId: number, action: string) {

        const userPermissions = await PermissionService.userPermissionGrants(userId);

        return PermissionService.hasPermission(userPermissions, action);
    }

    async userCan(userId: number, action: string) {
        return PermissionService.userCan(userId, action);
    }

    private async assignDefaultSystemRolePermissions(allPermissions: Permission[]): Promise<void> {
        const byName = new Map(allPermissions.map(permission => [permission.name, permission]));
        const defaults: Record<string, string[]> = {
            [RoleCode.PATIENT]: [
                PermissionEnum.ASSESSMENTS_VIEW_ASSIGNED,
                PermissionEnum.CLINICAL_VIEW_ASSIGNED,
                PermissionEnum.INFORMED_CONSENT_RESPONSES_VIEW_ASSIGNED,
            ],
            [RoleCode.CAREGIVER]: [
                PermissionEnum.PATIENTS_VIEW_ASSIGNED,
                PermissionEnum.ASSESSMENTS_VIEW_ASSIGNED,
                PermissionEnum.CLINICAL_VIEW_ASSIGNED,
                PermissionEnum.INFORMED_CONSENT_RESPONSES_VIEW_ASSIGNED,
            ],
            [RoleCode.THERAPIST]: [
                PermissionEnum.PATIENTS_VIEW_ASSIGNED,
                PermissionEnum.PATIENTS_EDIT_ASSIGNED,
                PermissionEnum.CAREGIVERS_VIEW_ASSIGNED,
                PermissionEnum.CAREGIVERS_EDIT_ASSIGNED,
                PermissionEnum.CLINICAL_VIEW_ASSIGNED,
                PermissionEnum.CLINICAL_CREATE_ASSIGNED,
                PermissionEnum.CLINICAL_EDIT_ASSIGNED,
                PermissionEnum.ASSESSMENTS_VIEW_ASSIGNED,
                PermissionEnum.ASSESSMENTS_CREATE_ASSIGNED,
                PermissionEnum.ASSESSMENTS_EDIT_ASSIGNED,
                PermissionEnum.ASSESSMENTS_DELETE_ASSIGNED,
                PermissionEnum.REPORTS_VIEW_ASSIGNED,
            ],
            [RoleCode.SUPERVISOR]: [
                PermissionEnum.USERS_VIEW_DEPARTMENT,
                PermissionEnum.THERAPISTS_VIEW_ASSIGNED,
                PermissionEnum.THERAPISTS_EDIT_ASSIGNED,
                PermissionEnum.PATIENTS_VIEW_DEPARTMENT,
                PermissionEnum.CLINICAL_VIEW_ASSIGNED,
                PermissionEnum.CLINICAL_CREATE_ASSIGNED,
                PermissionEnum.CLINICAL_EDIT_ASSIGNED,
                PermissionEnum.ASSESSMENTS_VIEW_ASSIGNED,
                PermissionEnum.ASSESSMENTS_CREATE_ASSIGNED,
                PermissionEnum.ASSESSMENTS_EDIT_ASSIGNED,
                PermissionEnum.ASSESSMENTS_DELETE_ASSIGNED,
                PermissionEnum.REPORTS_VIEW_ASSIGNED,
            ],
            [RoleCode.DEPARTMENT_ADMIN]: [
                PermissionEnum.USERS_VIEW_DEPARTMENT_HIERARCHY,
                PermissionEnum.USERS_CREATE_DEPARTMENT_HIERARCHY,
                PermissionEnum.USERS_EDIT_DEPARTMENT_HIERARCHY,
                PermissionEnum.USERS_DELETE_DEPARTMENT_HIERARCHY,
                PermissionEnum.USERS_RESTORE_DEPARTMENT_HIERARCHY,
                PermissionEnum.PATIENTS_VIEW_DEPARTMENT,
                PermissionEnum.PATIENTS_CREATE_DEPARTMENT,
                PermissionEnum.PATIENTS_EDIT_DEPARTMENT,
                PermissionEnum.PATIENTS_DELETE_DEPARTMENT,
                PermissionEnum.PATIENTS_ARCHIVE_DEPARTMENT,
                PermissionEnum.PATIENTS_RESTORE_DEPARTMENT,
                PermissionEnum.THERAPISTS_VIEW_DEPARTMENT,
                PermissionEnum.THERAPISTS_CREATE_DEPARTMENT,
                PermissionEnum.THERAPISTS_EDIT_DEPARTMENT,
                PermissionEnum.THERAPISTS_DELETE_DEPARTMENT,
                PermissionEnum.SUPERVISORS_VIEW_DEPARTMENT,
                PermissionEnum.SUPERVISORS_CREATE_DEPARTMENT,
                PermissionEnum.SUPERVISORS_EDIT_DEPARTMENT,
                PermissionEnum.SUPERVISORS_DELETE_DEPARTMENT,
                PermissionEnum.CAREGIVERS_VIEW_DEPARTMENT,
                PermissionEnum.CAREGIVERS_CREATE_DEPARTMENT,
                PermissionEnum.CAREGIVERS_EDIT_DEPARTMENT,
                PermissionEnum.CAREGIVERS_DELETE_DEPARTMENT,
                PermissionEnum.CLINICAL_VIEW_DEPARTMENT,
                PermissionEnum.CLINICAL_CREATE_DEPARTMENT,
                PermissionEnum.CLINICAL_EDIT_DEPARTMENT,
                PermissionEnum.CLINICAL_DELETE_DEPARTMENT,
                PermissionEnum.ASSESSMENTS_VIEW_DEPARTMENT,
                PermissionEnum.ASSESSMENTS_CREATE_DEPARTMENT,
                PermissionEnum.ASSESSMENTS_EDIT_DEPARTMENT,
                PermissionEnum.ASSESSMENTS_DELETE_DEPARTMENT,
                PermissionEnum.ASSESSMENTS_ARCHIVE_DEPARTMENT,
                PermissionEnum.ASSESSMENTS_RESTORE_DEPARTMENT,
                PermissionEnum.ASSESSMENTS_ASSIGN_DEPARTMENT,
                PermissionEnum.QUESTIONNAIRES_VIEW_DEPARTMENT,
                PermissionEnum.QUESTIONNAIRES_CREATE_DEPARTMENT,
                PermissionEnum.QUESTIONNAIRES_EDIT_DEPARTMENT,
                PermissionEnum.QUESTIONNAIRES_DELETE_DEPARTMENT,
                PermissionEnum.QUESTIONNAIRE_BUNDLES_VIEW_DEPARTMENT,
                PermissionEnum.QUESTIONNAIRE_BUNDLES_CREATE_DEPARTMENT,
                PermissionEnum.QUESTIONNAIRE_BUNDLES_EDIT_DEPARTMENT,
                PermissionEnum.QUESTIONNAIRE_BUNDLES_DELETE_DEPARTMENT,
                PermissionEnum.EVALUATION_SCHEMES_VIEW_DEPARTMENT,
                PermissionEnum.EVALUATION_SCHEMES_CREATE_DEPARTMENT,
                PermissionEnum.EVALUATION_SCHEMES_EDIT_DEPARTMENT,
                PermissionEnum.EVALUATION_SCHEMES_DELETE_DEPARTMENT,
                PermissionEnum.RANDOMIZATIONS_VIEW_DEPARTMENT,
                PermissionEnum.RANDOMIZATIONS_CREATE_DEPARTMENT,
                PermissionEnum.RANDOMIZATIONS_EDIT_DEPARTMENT,
                PermissionEnum.RANDOMIZATIONS_DELETE_DEPARTMENT,
                PermissionEnum.AUTOMATIONS_VIEW_DEPARTMENT,
                PermissionEnum.AUTOMATIONS_CREATE_DEPARTMENT,
                PermissionEnum.AUTOMATIONS_EDIT_DEPARTMENT,
                PermissionEnum.AUTOMATIONS_DELETE_DEPARTMENT,
                PermissionEnum.AUTOMATIONS_TEST_DEPARTMENT,
                PermissionEnum.NOTIFICATIONS_VIEW_DEPARTMENT,
                PermissionEnum.NOTIFICATIONS_CREATE_DEPARTMENT,
                PermissionEnum.NOTIFICATIONS_EDIT_DEPARTMENT,
                PermissionEnum.NOTIFICATIONS_DELETE_DEPARTMENT,
                PermissionEnum.NOTIFICATION_LOGS_VIEW_DEPARTMENT,
                PermissionEnum.MAIL_TEMPLATES_VIEW_DEPARTMENT,
                PermissionEnum.MAIL_TEMPLATES_CREATE_DEPARTMENT,
                PermissionEnum.MAIL_TEMPLATES_EDIT_DEPARTMENT,
                PermissionEnum.MAIL_TEMPLATES_DELETE_DEPARTMENT,
                PermissionEnum.INFORMED_CONSENT_MODELS_VIEW_DEPARTMENT,
                PermissionEnum.INFORMED_CONSENT_MODELS_CREATE_DEPARTMENT,
                PermissionEnum.INFORMED_CONSENT_MODELS_EDIT_DEPARTMENT,
                PermissionEnum.INFORMED_CONSENT_MODELS_DELETE_DEPARTMENT,
                PermissionEnum.INFORMED_CONSENT_MANAGEMENT_VIEW_DEPARTMENT,
                PermissionEnum.INFORMED_CONSENT_MANAGEMENT_CREATE_DEPARTMENT,
                PermissionEnum.INFORMED_CONSENT_MANAGEMENT_EDIT_DEPARTMENT,
                PermissionEnum.INFORMED_CONSENT_MANAGEMENT_DELETE_DEPARTMENT,
                PermissionEnum.INFORMED_CONSENT_RESPONSES_VIEW_DEPARTMENT,
                PermissionEnum.INFORMED_CONSENT_RESPONSES_REVIEW_DEPARTMENT,
                PermissionEnum.REPORTS_VIEW_DEPARTMENT,
                PermissionEnum.REPORTS_CREATE_DEPARTMENT,
                PermissionEnum.REPORTS_EDIT_DEPARTMENT,
                PermissionEnum.REPORTS_DELETE_DEPARTMENT,
            ],
            [RoleCode.NO_ROLE]: [],
        };

        for (const [roleCode, permissionNames] of Object.entries(defaults)) {
            const role = await Role.findOne({
                where: { code: roleCode as RoleCode },
                relations: ['permissions'],
            });
            if (!role) continue;

            const nextPermissions = permissionNames
                .map(name => byName.get(name))
                .filter((permission): permission is Permission => !!permission);

            role.permissions = nextPermissions;
            await role.save();
        }
    }

    static hasPermission(grants: Permission[], requiredPermission: string): boolean {
        const grantNames = grants.map(permission => permission.name);
        if (grantNames.includes(requiredPermission)) return true;

        const required = PermissionService.parsePermission(requiredPermission);
        if (!required) return false;

        return grantNames.some(grantName => {
            const grant = PermissionService.parsePermission(grantName);
            if (!grant) return false;
            return grant.resource === required.resource &&
                grant.action === required.action &&
                grant.scope === 'all';
        });
    }

    private static parsePermission(permission: string): { resource: string; action: string; scope: string } | null {
        const parts = permission.split('.');
        if (parts.length !== 3) return null;
        const [resource, action, scope] = parts;
        if (!resource || !action || !scope) return null;
        return { resource, action, scope };
    }

    /**
     * Compares hierarchy of one user and another target
     * @param currentUser user to compare to target
     * @param targetUser target to compare with
     * @returns true when currentUser has stronger hierarchy than targetUser
     */
    static async compareHierarchy(currentUser: User | number, targetUser: User | number): Promise<boolean> {
        if (typeof currentUser === 'number') {
            currentUser = await User.findOneOrFail({
                where: { id: currentUser },
                relations: ['roles'],
            });
        }

        if (typeof targetUser === 'number') {
            targetUser = await User.findOneOrFail({
                where: { id: targetUser },
                relations: ['roles'],
            });
        }

        // true if currentUser is stronger than targetUser
        return Math.min(...currentUser.roles.map(r => r.hierarchy)) < Math.min(...targetUser.roles.map(r => r.hierarchy));
    }
}
