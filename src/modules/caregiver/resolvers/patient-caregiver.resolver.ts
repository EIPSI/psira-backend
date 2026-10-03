import { UseGuards } from "@nestjs/common";
import { Args, ArgsType, Resolver, Query, InputType, Mutation } from "@nestjs/graphql";
import { GqlAuthGuard } from "src/modules/auth/auth.guard";
import { PermissionGuard } from "src/modules/permission/guards/permission.guard";
import { PermissionEnum } from "src/modules/permission/enums/permission.enum";
import { UseOrPermissions } from "src/modules/permission/decorators/permission.decorator";
import { PatientCaregiver } from "../models/patient-caregiver.model";
import { PatientCaregiverService } from "../services/patient.caregiver.service";
import { CreateOneInputType, QueryArgsType } from "@nestjs-query/query-graphql";
import { PatientCaregiverInput } from "../dtos/patient.caregiver.input";
import { CurrentUser } from "src/modules/auth/auth-user.decorator";
import { User } from "src/modules/user/models/user.model";
import { RoleCode } from "src/modules/permission/enums/role-code.enum";
import { PermissionService } from "src/modules/permission/providers/permission.service";
import { SortDirection } from "@nestjs-query/core";

@ArgsType()
class PatientCaregiverQuery extends QueryArgsType(PatientCaregiver) { }

const PatientCaregiverConnection = PatientCaregiverQuery.ConnectionType;

@InputType()
export class CreateOnePatientCaregiverInput extends CreateOneInputType('patientCaregiver', PatientCaregiverInput) { }

@Resolver(() => PatientCaregiver)
@UseGuards(GqlAuthGuard, PermissionGuard)
export class PatientCaregiverResolver {
    constructor(
        private readonly patinetCaregiverService: PatientCaregiverService

    ) { }


    @UseOrPermissions([
        PermissionEnum.CAREGIVERS_VIEW_ALL,
        PermissionEnum.CAREGIVERS_VIEW_DEPARTMENT,
        PermissionEnum.CAREGIVERS_VIEW_ASSIGNED,
    ])
    @Query(() => PatientCaregiverConnection)
    async patientCaregivers(
        @Args({ type: () => PatientCaregiverQuery }) query: PatientCaregiverQuery,
        @CurrentUser() currentUser: User,
    ): Promise<any> {
        query.sorting = query.sorting?.length
            ? query.sorting
            : [{ field: 'id', direction: SortDirection.DESC }];

        const roleCodes = (currentUser?.roles || []).map(role => role.code);
        const hasAdministrativeRole = roleCodes.some(roleCode =>
            [RoleCode.SUPER_ADMIN, RoleCode.DEPARTMENT_ADMIN, RoleCode.SUPERVISOR].includes(roleCode as RoleCode),
        );
        const canViewBroadScope =
            hasAdministrativeRole && (
                await PermissionService.userCan(currentUser.id, PermissionEnum.CAREGIVERS_VIEW_ALL) ||
                await PermissionService.userCan(currentUser.id, PermissionEnum.CAREGIVERS_VIEW_DEPARTMENT)
            );

        if (canViewBroadScope) {
            return PatientCaregiverConnection.createFromPromise(
                (q) => this.patinetCaregiverService.query(q),
                query,
                (q) => this.patinetCaregiverService.count(q),
            );
        }

        return PatientCaregiverConnection.createFromPromise(
            (q) => this.patinetCaregiverService.queryAssignedToCaseManager(q, currentUser.id),
            query,
            (q) => this.patinetCaregiverService.countAssignedToCaseManager(q as any, currentUser.id),
        );
    }

    @Mutation(() => PatientCaregiver)
    @UseOrPermissions([PermissionEnum.CAREGIVERS_EDIT_DEPARTMENT, PermissionEnum.CAREGIVERS_EDIT_ASSIGNED])
    async createOnePatientCaregiver(
        @Args('input', { type: () => CreateOnePatientCaregiverInput }) input: CreateOnePatientCaregiverInput,
    ): Promise<PatientCaregiver> {
        try {
            const caregiverInput = input['patientCaregiver'] as PatientCaregiverInput;
            return await this.patinetCaregiverService.insert(caregiverInput)
        } catch (error) {
            error.message = error.message === 'Conflict' ? 'Caregiver with this number already exists. Use the previous menu to add an existing caregiver or update number to create new one.' : error.message;
            return error;
        }
    }
}


