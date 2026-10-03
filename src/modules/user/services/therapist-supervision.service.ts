import { BadRequestException, Injectable } from '@nestjs/common';
import { createQueryBuilder, getManager } from 'typeorm';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { RoleCode } from 'src/modules/permission/enums/role-code.enum';
import { PermissionService } from 'src/modules/permission/providers/permission.service';
import { SettingService } from 'src/modules/setting/providers/setting.service';
import { AssignmentRequestService } from 'src/modules/assignment-request/services/assignment-request.service';
import { Patient } from 'src/modules/patient/models/patient.model';
import { UserConnectionDto } from '../dto/user-connection.model';
import { SupervisionFilter } from '../dto/supervision.filter';
import { User } from '../models/user.model';
import { applySearchQuery } from 'src/shared/helpers/search.helper';
import { paginate } from 'src/shared/pagination/services/paginate';

@Injectable()
export class TherapistSupervisionService {
    constructor(
        private readonly settingService: SettingService,
        private readonly assignmentRequestService: AssignmentRequestService,
    ) {}

    async getTherapists(filter: SupervisionFilter, currentUser: User): Promise<UserConnectionDto> {
        const query = User.createQueryBuilder('therapist')
            .innerJoin('therapist.roles', 'role', 'role.code = :roleCode', { roleCode: RoleCode.THERAPIST })
            .leftJoinAndSelect('therapist.roles', 'roles')
            .leftJoinAndSelect('therapist.departments', 'departments')
            .leftJoinAndSelect('therapist.permissions', 'permissions')
            .andWhere('therapist.deletedAt IS NULL');

        if (filter.searchKeyword) {
            applySearchQuery(query, filter.searchKeyword, User.searchable);
        }

        if (filter.supervisorId) {
            query.innerJoin('therapist.supervisors', 'filterSupervisor', 'filterSupervisor.id = :supervisorId', {
                supervisorId: filter.supervisorId,
            });
        } else if (!(await this.canViewAllDepartmentUsers(currentUser.id))) {
            query.innerJoin('therapist.supervisors', 'currentSupervisor', 'currentSupervisor.id = :currentUserId', {
                currentUserId: currentUser.id,
            });
        } else {
            const departmentIds = await this.getUserDepartmentIds(currentUser.id);
            if (departmentIds.length) {
                query.innerJoin('therapist.departments', 'filterDepartment', 'filterDepartment.id IN (:...departmentIds)', {
                    departmentIds,
                });
            }
        }

        return paginate(query, filter, 'therapist.id');
    }

    async getSupervisors(filter: SupervisionFilter, currentUser: User): Promise<UserConnectionDto> {
        const supervisorRoleCodes = await this.getAssignableSupervisorRoleCodes();
        const query = User.createQueryBuilder('supervisor')
            .innerJoin('supervisor.roles', 'role', 'role.code IN (:...supervisorRoleCodes)', { supervisorRoleCodes })
            .leftJoinAndSelect('supervisor.roles', 'roles')
            .leftJoinAndSelect('supervisor.departments', 'departments')
            .leftJoinAndSelect('supervisor.permissions', 'permissions')
            .andWhere('supervisor.deletedAt IS NULL');

        if (filter.searchKeyword) {
            applySearchQuery(query, filter.searchKeyword, User.searchable);
        }

        if (filter.therapistId) {
            query.innerJoin('supervisor.supervisedTherapists', 'filterTherapist', 'filterTherapist.id = :therapistId', {
                therapistId: filter.therapistId,
            });
        } else if (!(await this.canViewAllDepartmentUsers(currentUser.id))) {
            query.innerJoin('supervisor.supervisedTherapists', 'filterTherapist', 'filterTherapist.id = :currentUserId', {
                currentUserId: currentUser.id,
            });
        } else {
            const departmentIds = await this.getUserDepartmentIds(currentUser.id);
            if (departmentIds.length) {
                query.innerJoin('supervisor.departments', 'filterDepartment', 'filterDepartment.id IN (:...departmentIds)', {
                    departmentIds,
                });
            }
        }

        return paginate(query, filter, 'supervisor.id');
    }

    async assignTherapistSupervisor(therapistId: number, supervisorId: number, requesterId?: number): Promise<boolean> {
        await this.validateTherapistSupervisorAssignable(therapistId, supervisorId);

        const existing = await getManager()
            .createQueryBuilder()
            .from('therapist_supervisor', 'therapist_supervisor')
            .where('"therapistId" = :therapistId AND "supervisorId" = :supervisorId', { therapistId, supervisorId })
            .getRawOne();

        if (existing) return true;

        if (requesterId && supervisorId !== requesterId) {
            await this.assignmentRequestService.requestSupervisorAssignment(therapistId, supervisorId, requesterId);
            return true;
        }

        const result = await createQueryBuilder()
            .insert()
            .into('therapist_supervisor')
            .values([{ therapistId, supervisorId }])
            .execute();

        return !!result;
    }

    private async validateTherapistSupervisorAssignable(therapistId: number, supervisorId: number): Promise<void> {
        const therapist = await User.findOne(therapistId, { relations: ['roles', 'departments'] });
        const supervisor = await User.findOne(supervisorId, { relations: ['roles', 'departments'] });

        if (!therapist || therapist.deletedAt || therapist.active === false || !therapist.roles?.some(role => role.code === RoleCode.THERAPIST)) {
            throw new BadRequestException('Only active therapist users can be assigned to supervisors.');
        }

        const supervisorRoleCodes = await this.getAssignableSupervisorRoleCodes();
        if (!supervisor || supervisor.deletedAt || supervisor.active === false || !supervisor.roles?.some(role => supervisorRoleCodes.includes(role.code as RoleCode))) {
            throw new BadRequestException('Only active users with an assignable supervisor role can supervise therapists.');
        }

        const therapistDepartmentIds = therapist.departments?.map(department => department.id) || [];
        const supervisorDepartmentIds = supervisor.departments?.map(department => department.id) || [];
        const sharesDepartment = therapistDepartmentIds.some(id => supervisorDepartmentIds.includes(id));

        if (!sharesDepartment) {
            throw new BadRequestException('Therapist and supervisor must share at least one department.');
        }
    }

    async unassignTherapistSupervisor(therapistId: number, supervisorId: number): Promise<boolean> {
        const result = await createQueryBuilder()
            .delete()
            .from('therapist_supervisor')
            .where('"therapistId" = :therapistId AND "supervisorId" = :supervisorId', { therapistId, supervisorId })
            .execute();

        await createQueryBuilder()
            .delete()
            .from('therapist_supervisor_patient')
            .where('"therapistId" = :therapistId AND "supervisorId" = :supervisorId', { therapistId, supervisorId })
            .execute();

        return result.affected > 0;
    }

    async assignSupervisorPatientVisibility(therapistId: number, supervisorId: number, patientId: number, requesterId?: number): Promise<boolean> {
        await this.assignTherapistSupervisor(therapistId, supervisorId, requesterId);

        const existing = await getManager()
            .createQueryBuilder()
            .from('therapist_supervisor_patient', 'therapist_supervisor_patient')
            .where(
                '"therapistId" = :therapistId AND "supervisorId" = :supervisorId AND "patientId" = :patientId',
                { therapistId, supervisorId, patientId },
            )
            .getRawOne();

        if (existing) return true;

        const result = await createQueryBuilder()
            .insert()
            .into('therapist_supervisor_patient')
            .values([{ therapistId, supervisorId, patientId }])
            .execute();

        return !!result;
    }

    async unassignSupervisorPatientVisibility(therapistId: number, supervisorId: number, patientId: number): Promise<boolean> {
        const result = await createQueryBuilder()
            .delete()
            .from('therapist_supervisor_patient')
            .where(
                '"therapistId" = :therapistId AND "supervisorId" = :supervisorId AND "patientId" = :patientId',
                { therapistId, supervisorId, patientId },
            )
            .execute();

        return result.affected > 0;
    }

    async getSupervisorVisiblePatients(therapistId: number, supervisorId: number): Promise<Patient[]> {
        return Patient.createQueryBuilder('patient')
            .innerJoin(
                'therapist_supervisor_patient',
                'visibility',
                'visibility."patientId" = patient.id AND visibility."therapistId" = :therapistId AND visibility."supervisorId" = :supervisorId',
                { therapistId, supervisorId },
            )
            .getMany();
    }

    private async getAssignableSupervisorRoleCodes(): Promise<RoleCode[]> {
        const value = await this.settingService.getKey('therapistSupervisorRoleCodes' as any) as RoleCode[];
        return value?.length ? value : [RoleCode.SUPERVISOR];
    }

    private async canViewAllDepartmentUsers(userId: number): Promise<boolean> {
        return (
            await PermissionService.userCan(userId, PermissionEnum.THERAPISTS_VIEW_ALL) ||
            await PermissionService.userCan(userId, PermissionEnum.SUPERVISORS_VIEW_ALL) ||
            await PermissionService.userCan(userId, PermissionEnum.USERS_VIEW_ALL)
        );
    }

    private async getUserDepartmentIds(userId: number): Promise<number[]> {
        const user = await User.findOne({
            where: { id: userId },
            relations: ['departments'],
        });

        return user?.departments?.map(department => department.id) ?? [];
    }
}
