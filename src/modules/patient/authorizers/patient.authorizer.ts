import { Filter } from '@nestjs-query/core';
import { Patient } from "../models/patient.model";
import { PatientPermissionService, PatientAccessScope } from '../services/patient-permission.service';
import { PermissionService } from 'src/modules/permission/providers/permission.service';
import { UnauthorizedException } from '@nestjs/common';

export class PatientAuthorizer {

    /**
     * Returns a filter of the Patients Query,
     * By the current user id's permissions and scope.
     * 
     * @param userId 
     * @returns 
     */
    static async authorizePatient(userId: number): Promise<Filter<Patient>> {
        // Inject service manually due to static context
        const permissionService = new PatientPermissionService(new PermissionService());
        
        const scope = await permissionService.getUserAccessScope(userId);

        switch (scope.type) {
            case PatientAccessScope.ALL:
                return {}; // No filter - see all patients

            case PatientAccessScope.DEPARTMENT:
                if (!scope.departmentIds || scope.departmentIds.length === 0) {
                    throw new UnauthorizedException('You need to be assigned at least one department to view patients.');
                }
                return {
                    or: [
                        { departments: { id: { in: scope.departmentIds } } },
                    ]
                };

            case PatientAccessScope.ASSIGNED:
                return {
                    or: [
                        { caseManagers: { id: { eq: scope.userId } } },
                    ]
                };

            default:
                throw new UnauthorizedException('You do not have permission to view patients.');
        }
    }

}
