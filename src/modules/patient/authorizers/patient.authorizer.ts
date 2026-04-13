import { Filter } from '@nestjs-query/core';
import { Patient } from "../models/patient.model";
import { User } from "src/modules/user/models/user.model";
import { PermissionService } from 'src/modules/permission/providers/permission.service';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { UnauthorizedException } from '@nestjs/common';

export class PatientAuthorizer {

    /**
     * Returns a filter of the Patients Query,
     * By the current user id's departments.
     * 
     * @param userId 
     * @returns 
     */
    static async authorizePatient(userId: number): Promise<Filter<Patient>> {

        // Reload current user with departments
        const currentUser = await User.findOne({
            where: { id: userId },
            relations: ['departments'],
        });

        // 1. VIEW_ALL_PATIENTS: Return empty filter (no restriction)
        if (await PermissionService.userCan(currentUser.id, PermissionEnum.VIEW_ALL_PATIENTS)) {
            return {};
        }

        // 2. VIEW_DEPARTMENT_PATIENTS: Filter by user's departments
        if (await PermissionService.userCan(currentUser.id, PermissionEnum.VIEW_DEPARTMENT_PATIENTS)) {
            const departmentIds = currentUser.departments.map(d => d.id);
            if (departmentIds.length === 0) {
                throw new UnauthorizedException('You need to be assigned at least one department to view patients.');
            }
            return this.filterByDepartments(departmentIds);
        }

        // 3. VIEW_ASSIGNED_PATIENTS: Filter by user.id as case manager
        if (await PermissionService.userCan(currentUser.id, PermissionEnum.VIEW_ASSIGNED_PATIENTS)) {
            return this.filterByAssignedUser(currentUser.id);
        }

        // Default: VIEW_PATIENTS only - keep existing behavior
        const departmentIds = currentUser.departments.map(d => d.id);
        if (departmentIds.length === 0) {
            throw new UnauthorizedException('You need to be assigned at least one department to view patients.');
        }
        return this.filterByDepartments(departmentIds);
    }

    private static filterByDepartments(departmentIds: number[]): Filter<Patient> {
        return {
            or: [
                { departments: { id: { in: departmentIds } } },
            ]
        };
    }

    private static filterByAssignedUser(userId: number): Filter<Patient> {
        return {
            or: [
                { caseManagers: { id: { eq: userId } } },
            ]
        };
    }

}
