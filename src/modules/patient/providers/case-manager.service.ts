import { BadRequestException, Injectable } from "@nestjs/common";
import { SettingService } from "src/modules/setting/providers/setting.service";
import { UserConnectionDto } from "src/modules/user/dto/user-connection.model";
import { User } from "src/modules/user/models/user.model";
import { applySearchQuery } from "src/shared/helpers/search.helper";
import { paginate } from "src/shared/pagination/services/paginate";
import { createQueryBuilder, getManager } from "typeorm";
import { CaseManagerFilter } from "../dto/case-manager.filter";


@Injectable()
export class CaseManagerService {
    constructor(private readonly settingService: SettingService) {}

    async getPatientCaseManagers(caseManagerFilter: CaseManagerFilter): Promise<UserConnectionDto> {
        const assignableHierarchyRank = await this.getAssignableCaseManagerHierarchyRank();

        const query = User
            .createQueryBuilder('caseManager')
            .distinct(true)
            .innerJoin('caseManager.roles', 'role', 'role.hierarchy <= :assignableHierarchyRank', {
                assignableHierarchyRank,
            });

        // apply global search
        if (caseManagerFilter.searchKeyword) {
            applySearchQuery(query, caseManagerFilter.searchKeyword, User.searchable)
        }

        // Filter by patientId
        if (caseManagerFilter.patientId) {
            query.innerJoin(
                "caseManager.caseManagedPatients",
                "patient",
                "patient.id = :patientId",
                { patientId: caseManagerFilter.patientId });
        }

        // Filter by Case Manager Id
        else if (caseManagerFilter.caseManagerId) {
            query.innerJoin(
                "caseManager.caseManagedPatients",
                "patient",
                "caseManager.id = :caseManagerId",
                { caseManagerId: caseManagerFilter.caseManagerId });
        }

        // Filter all case-managers
        else {
            query.innerJoin(
                "caseManager.caseManagedPatients",
                "patient",
            );
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
        await this.validateCaseManagerAssignable(userId, assigningUserId);

        const caseManager = await getManager()
            .createQueryBuilder()
            .from('patient_case_manager', 'patient_case_manager')
            .where({ patientId, userId })
            .getRawOne();

        if (caseManager) {
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
        userId: number,
        assigningUserId: number,
    ): Promise<void> {
        const assigner = await User.findOne(assigningUserId, {
            relations: ['roles'],
        });
        const assignerHierarchy = this.strongestHierarchy(assigner);
        const assignableHierarchyRank = await this.getAssignableCaseManagerHierarchyRank();

        const caseManager = await User.createQueryBuilder('user')
            .innerJoinAndSelect('user.roles', 'role')
            .where('user.id = :userId', { userId })
            .getOne();

        const caseManagerHierarchy = this.strongestHierarchy(caseManager);
        if (
            !caseManager ||
            caseManagerHierarchy < assignerHierarchy ||
            caseManagerHierarchy > assignableHierarchyRank
        ) {
            throw new BadRequestException(
                'Only users at or below the configured hierarchy rank and at the same or lower hierarchy than the assigner can be assigned as case managers',
            );
        }
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
