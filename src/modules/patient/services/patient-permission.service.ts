import { Injectable } from '@nestjs/common';
import { PermissionService } from 'src/modules/permission/providers/permission.service';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { User } from 'src/modules/user/models/user.model';

export enum PatientAccessScope {
    ALL = 'ALL',
    DEPARTMENT = 'DEPARTMENT',
    ASSIGNED = 'ASSIGNED',
}

export interface UserAccessScope {
    type: PatientAccessScope;
    departmentIds?: number[];
    userId?: number;
}

@Injectable()
export class PatientPermissionService {
    constructor(private readonly permissionService: PermissionService) {}

    /**
     * Get the user's patient access scope
     */
    async getUserAccessScope(userId: number): Promise<UserAccessScope> {
        if (await this.permissionService.userCan(userId, PermissionEnum.PATIENTS_VIEW_ALL)) {
            return { type: PatientAccessScope.ALL };
        }

        const user = await User.findOne({
            where: { id: userId },
            relations: ['departments'],
        });
        const departmentIds = user ? user.departments.map(d => d.id) : [];

        if (await this.permissionService.userCan(userId, PermissionEnum.PATIENTS_VIEW_DEPARTMENT)) {
            return { type: PatientAccessScope.DEPARTMENT, departmentIds };
        }

        if (await this.permissionService.userCan(userId, PermissionEnum.PATIENTS_VIEW_ASSIGNED)) {
            return { type: PatientAccessScope.ASSIGNED, userId, departmentIds };
        }

        // Default: fall back to department access.
        return { type: PatientAccessScope.DEPARTMENT, departmentIds };
    }

    /**
     * Check if user can create patients in specific departments
     */
    async canCreateInDepartments(userId: number, departmentIds: number[]): Promise<boolean> {
        const scope = await this.getUserAccessScope(userId);

        if (scope.type === PatientAccessScope.ALL) {
            return true;
        }

        // For both DEPARTMENT and ASSIGNED scopes, we check department membership
        return departmentIds.every(did => scope.departmentIds?.includes(did));
    }

    /**
     * Check if user can assign specific case managers
     */
    async canAssignCaseManagers(userId: number, caseManagerIds: number[], patientDepartmentIds: number[]): Promise<boolean> {
        const scope = await this.getUserAccessScope(userId);

        if (scope.type === PatientAccessScope.ALL) {
            return true;
        }

        if (scope.type === PatientAccessScope.ASSIGNED) {
            // Can only assign themselves
            return caseManagerIds.length === 1 && caseManagerIds[0] === userId;
        }

        // DEPARTMENT scope: case managers must be in patient's departments
        if (patientDepartmentIds.length === 0) return false;

        const departmentMembers = await User.createQueryBuilder('user')
            .innerJoin('user.departments', 'department')
            .where('department.id IN (:...departmentIds)', { departmentIds: patientDepartmentIds })
            .getMany();

        const memberIds = departmentMembers.map(u => u.id);
        return caseManagerIds.every(cmId => memberIds.includes(cmId));
    }
}
