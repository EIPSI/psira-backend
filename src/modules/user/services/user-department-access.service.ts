import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../models/user.model';
import { Role } from 'src/modules/permission/models/role.model';
import { RoleCode } from 'src/modules/permission/enums/role-code.enum';
import { PermissionService } from 'src/modules/permission/providers/permission.service';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';

export enum DepartmentAccessScope {
    ALL = 'ALL',          // SuperAdmin: ve todo
    INSTITUTION = 'INSTITUTION',  // Ver usuarios/registros de su institución (departamentos)
}

export interface UserDepartmentAccess {
    scope: DepartmentAccessScope;
    departmentIds?: number[];
}

@Injectable()
export class UserDepartmentAccessService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Role)
        private readonly roleRepository: Repository<Role>,
        private readonly permissionService: PermissionService,
    ) {}

    /**
     * Get user's department access scope
     */
    async getUserDepartmentAccess(userId: number): Promise<UserDepartmentAccess> {
        if (
            await this.permissionService.userCan(userId, PermissionEnum.MANAGE_USERS) ||
            await this.permissionService.userCan(userId, PermissionEnum.ASSIGN_ANY_ASSESSMENT_USER)
        ) {
            return { scope: DepartmentAccessScope.ALL };
        }

        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ['departments'],
        });

        if (!user || !user.departments || user.departments.length === 0) {
            return { scope: DepartmentAccessScope.INSTITUTION, departmentIds: [] };
        }

        const departmentIds = user.departments.map(d => d.id);
        return { scope: DepartmentAccessScope.INSTITUTION, departmentIds };
    }

    /**
     * Get department IDs user belongs to
     */
    async getUserDepartmentIds(userId: number): Promise<number[]> {
        const access = await this.getUserDepartmentAccess(userId);
        return access.departmentIds || [];
    }

    /**
     * Check if user can create/modify records in specific departments
     */
    async canAccessDepartments(userId: number, departmentIds: number[]): Promise<boolean> {
        const access = await this.getUserDepartmentAccess(userId);

        if (access.scope === DepartmentAccessScope.ALL) {
            return true;
        }

        if (!access.departmentIds || access.departmentIds.length === 0) {
            return false;
        }

        // All provided departmentIds must be within user's departments
        return departmentIds.every(did => access.departmentIds.includes(did));
    }

    /**
     * Check if user can assign a role to another user
     * Only if target user is in same or lower department(s)
     */
    async canAssignRole(
        creatorUserId: number,
        targetUserId: number,
        targetRoleCode: RoleCode,
        targetDepartmentIds?: number[],
    ): Promise<boolean> {
        const creatorAccess = await this.getUserDepartmentAccess(creatorUserId);

        // SuperAdmin can assign any role
        if (creatorAccess.scope === DepartmentAccessScope.ALL) {
            return true;
        }

        // Check creator's permission to manage users
        if (!await this.permissionService.userCan(creatorUserId, PermissionEnum.MANAGE_USERS)) {
            return false;
        }

        // Get role hierarchy values
        const creatorUser = await this.userRepository.findOne({
            where: { id: creatorUserId },
            relations: ['roles'],
        });

        const targetUser = await this.userRepository.findOne({
            where: { id: targetUserId },
            relations: ['roles'],
        });

        if (!creatorUser || !targetUser) {
            return false;
        }

        // Get max hierarchy of creator's roles
        const creatorMaxHierarchy = Math.min(...creatorUser.roles.map(r => r.hierarchy));

        // Get hierarchy of target role
        const targetRole = await this.roleRepository.findOne({
            where: { code: targetRoleCode },
        });

        if (!targetRole) {
            return false;
        }

        // Can only assign roles of lower or equal hierarchy
        if (targetRole.hierarchy < creatorMaxHierarchy) {
            return false;
        }

        // If target has departments, creator must have access to those departments
        if (targetDepartmentIds && targetDepartmentIds.length > 0) {
            if ((creatorAccess.scope as DepartmentAccessScope) === DepartmentAccessScope.ALL) {
                return true; // SuperAdmin can assign any departments
            }

            // Check if creator has access to target departments
            return targetDepartmentIds.every(did => creatorAccess.departmentIds?.includes(did));
        }

        return true;
    }

    /**
     * Get maximum hierarchy value for a set of role codes
     */
    async getRoleHierarchy(roleCodes: string[]): Promise<number> {
        if (!roleCodes || roleCodes.length === 0) {
            return 999;
        }

        const roles = await this.roleRepository.find({
            where: { code: In(roleCodes) },
        });

        if (roles.length === 0) return 999;

        return Math.min(...roles.map(r => r.hierarchy));
    }
}
