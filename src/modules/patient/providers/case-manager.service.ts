import { BadRequestException, Injectable } from "@nestjs/common";
import { SettingService } from "src/modules/setting/providers/setting.service";
import { AssignmentRequestService } from "src/modules/assignment-request/services/assignment-request.service";
import { UserConnectionDto } from "src/modules/user/dto/user-connection.model";
import { User } from "src/modules/user/models/user.model";
import { applySearchQuery } from "src/shared/helpers/search.helper";
import { paginate } from "src/shared/pagination/services/paginate";
import { Brackets, createQueryBuilder, getManager } from "typeorm";
import { RoleCode } from "src/modules/permission/enums/role-code.enum";
import { Patient } from "../models/patient.model";
import { CaseManagerFilter } from "../dto/case-manager.filter";


@Injectable()
export class CaseManagerService {
    constructor(
        private readonly settingService: SettingService,
        private readonly assignmentRequestService: AssignmentRequestService,
    ) {}

    async getPatientCaseManagers(caseManagerFilter: CaseManagerFilter): Promise<UserConnectionDto> {
        const assignableRoleCodes = await this.getAssignableCaseManagerRoleCodes();
        const allowSuperAdmin = assignableRoleCodes.includes(RoleCode.SUPER_ADMIN);
        const query = User
            .createQueryBuilder('caseManager')
            .distinct(true)
            .innerJoin('caseManager.roles', 'role', 'role.code IN (:...assignableRoleCodes)', {
                assignableRoleCodes,
            })
            .leftJoinAndSelect('caseManager.roles', 'roles')
            .leftJoinAndSelect('caseManager.departments', 'departments')
            .where('caseManager.active = true')
            .andWhere('caseManager.deletedAt IS NULL');

        if (caseManagerFilter.searchKeyword) {
            applySearchQuery(query, caseManagerFilter.searchKeyword, User.searchable);
        }

        if (caseManagerFilter.patientId) {
            query.innerJoin(
                'caseManager.caseManagedPatients',
                'assignedPatient',
                'assignedPatient.id = :patientId',
                { patientId: caseManagerFilter.patientId },
            );
        } else if (caseManagerFilter.departmentIds?.length) {
            query.andWhere(new Brackets(qb => {
                qb.where('departments.id IN (:...departmentIds)', { departmentIds: caseManagerFilter.departmentIds });
                if (allowSuperAdmin) {
                    qb.orWhere('role.code = :superAdminRole', { superAdminRole: RoleCode.SUPER_ADMIN });
                }
            }));
        }

        if (caseManagerFilter.caseManagerId) {
            query.andWhere('caseManager.id = :caseManagerId', {
                caseManagerId: caseManagerFilter.caseManagerId,
            });
        }

        return paginate(query, caseManagerFilter, 'caseManager.id');
    }

    async unassignPatientCaseManager(patientId: number, userId: number): Promise<boolean> {

        const result = await createQueryBuilder()
            .delete()
            .from('patient_case_manager')
            .where({ patientId, userId })
            .execute();


        return result.affected > 0;
    }

    async assignPatientCaseManager(
        patientId: number,
        userId: number,
        assigningUserId: number,
    ): Promise<boolean> {
        await this.validateCaseManagerAssignable(patientId, userId, assigningUserId);

        const caseManager = await getManager()
            .createQueryBuilder()
            .from('patient_case_manager', 'patient_case_manager')
            .where({ patientId, userId })
            .getRawOne();

        if (caseManager) {
            return true;
        }

        if (userId !== assigningUserId) {
            await this.assignmentRequestService.requestCaseManagerAssignment(patientId, userId, assigningUserId);
            return true;
        }

        const result = await createQueryBuilder()
            .insert()
            .into('patient_case_manager')
            .values([
                { patientId, userId }
            ])
            .execute();

        return result ? true : false;
    }

    private async validateCaseManagerAssignable(
        patientId: number,
        userId: number,
        assigningUserId: number,
    ): Promise<void> {
        const assigner = await User.findOne(assigningUserId, {
            relations: ['roles'],
        });
        const assignerHierarchy = this.strongestHierarchy(assigner);
        const assignableHierarchyRank = await this.getAssignableCaseManagerHierarchyRank();
        const assignableRoleCodes = await this.getAssignableCaseManagerRoleCodes();

        const caseManager = await User.createQueryBuilder('user')
            .innerJoinAndSelect('user.roles', 'role')
            .leftJoinAndSelect('user.departments', 'departments')
            .where('user.id = :userId', { userId })
            .andWhere('user.active = true')
            .andWhere('user.deletedAt IS NULL')
            .getOne();

        const caseManagerHierarchy = this.strongestHierarchy(caseManager);
        const hasAssignableRole = caseManager?.roles?.some(role => assignableRoleCodes.includes(role.code as RoleCode));
        if (
            !caseManager ||
            !hasAssignableRole ||
            caseManagerHierarchy < assignerHierarchy ||
            caseManagerHierarchy > assignableHierarchyRank
        ) {
            throw new BadRequestException(
                'Only active users with an assignable case-manager role at or below the configured hierarchy rank and at the same or lower hierarchy than the assigner can be assigned as case managers',
            );
        }

        await this.validateCaseManagerSharesPatientDepartment(userId, patientId);
    }

    private async validateCaseManagerSharesPatientDepartment(userId: number, patientId: number): Promise<void> {
        const patient = await Patient.findOne(patientId, { relations: ['departments'] });
        const patientDepartmentIds = patient?.departments?.map(department => department.id) || [];
        if (!patient || !patientDepartmentIds.length) {
            throw new BadRequestException('Patient must belong to at least one department to assign a case manager');
        }

        const user = await User.findOne(userId, { relations: ['roles', 'departments'] });
        const sharedDepartment = user?.departments?.some(department => patientDepartmentIds.includes(department.id));
        if (!sharedDepartment) {
            throw new BadRequestException('Case manager must belong to one of the patient departments');
        }
    }

    private async getAssignableCaseManagerRoleCodes(): Promise<RoleCode[]> {
        const value = await this.settingService.getKey('patientCaseManagerRoleCodes' as any) as RoleCode[];
        return value?.length ? value : [RoleCode.SUPER_ADMIN, RoleCode.THERAPIST];
    }

    private async getAssignableCaseManagerHierarchyRank(): Promise<number> {
        const value = await this.settingService.getKey(
            'patientCaseManagerAssignableHierarchyRank',
        );
        const rank = Number(value);
        return Number.isFinite(rank) ? rank : 0;
    }

    private strongestHierarchy(user?: User): number {
        const hierarchies = (user?.roles || [])
            .map(role => Number(role.hierarchy))
            .filter(hierarchy => Number.isFinite(hierarchy));
        return hierarchies.length ? Math.min(...hierarchies) : Number.MAX_SAFE_INTEGER;
    }
}
