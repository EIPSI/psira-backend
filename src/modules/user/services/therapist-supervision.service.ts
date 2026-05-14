import { Injectable } from '@nestjs/common';
import { createQueryBuilder, getManager } from 'typeorm';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { RoleCode } from 'src/modules/permission/enums/role-code.enum';
import { PermissionService } from 'src/modules/permission/providers/permission.service';
import { Patient } from 'src/modules/patient/models/patient.model';
import { UserConnectionDto } from '../dto/user-connection.model';
import { SupervisionFilter } from '../dto/supervision.filter';
import { User } from '../models/user.model';
import { applySearchQuery } from 'src/shared/helpers/search.helper';
import { paginate } from 'src/shared/pagination/services/paginate';

@Injectable()
export class TherapistSupervisionService {
    async getTherapists(filter: SupervisionFilter, currentUser: User): Promise<UserConnectionDto> {
        const query = User.createQueryBuilder('therapist')
            .innerJoin('therapist.roles', 'role', 'role.code = :roleCode', { roleCode: RoleCode.THERAPIST })
            .leftJoinAndSelect('therapist.roles', 'roles')
            .leftJoinAndSelect('therapist.departments', 'departments')
            .leftJoinAndSelect('therapist.permissions', 'permissions');

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
        const query = User.createQueryBuilder('supervisor')
            .innerJoin('supervisor.roles', 'role', 'role.code = :roleCode', { roleCode: RoleCode.SUPERVISOR })
            .leftJoinAndSelect('supervisor.roles', 'roles')
            .leftJoinAndSelect('supervisor.departments', 'departments')
            .leftJoinAndSelect('supervisor.permissions', 'permissions');

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

    async assignTherapistSupervisor(therapistId: number, supervisorId: number): Promise<boolean> {
        const existing = await getManager()
            .createQueryBuilder()
            .from('therapist_supervisor', 'therapist_supervisor')
            .where('"therapistId" = :therapistId AND "supervisorId" = :supervisorId', { therapistId, supervisorId })
            .getRawOne();

        if (existing) return true;

        const result = await createQueryBuilder()
            .insert()
            .into('therapist_supervisor')
            .values([{ therapistId, supervisorId }])
            .execute();

        return !!result;
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

    async assignSupervisorPatientVisibility(therapistId: number, supervisorId: number, patientId: number): Promise<boolean> {
        await this.assignTherapistSupervisor(therapistId, supervisorId);

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

    private async canViewAllDepartmentUsers(userId: number): Promise<boolean> {
        return PermissionService.userCan(userId, PermissionEnum.MANAGE_USERS);
    }

    private async getUserDepartmentIds(userId: number): Promise<number[]> {
        const user = await User.findOne({
            where: { id: userId },
            relations: ['departments'],
        });

        return user?.departments?.map(department => department.id) ?? [];
    }
}
