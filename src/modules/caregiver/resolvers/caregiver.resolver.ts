import { CreateOneInputType, DeleteOneInputType, QueryArgsType } from "@nestjs-query/query-graphql";
import { UseGuards } from "@nestjs/common";
import { Args, ArgsType, Resolver, Query, InputType, Mutation } from "@nestjs/graphql";
import { GqlAuthGuard } from "src/modules/auth/auth.guard";
import { PermissionGuard } from "src/modules/permission/guards/permission.guard";
import { Caregiver } from "../models/caregiver.model";
import { CaregiverService } from "../services/caregiver.service";
import { SortDirection } from '@nestjs-query/core';
import { PermissionEnum } from "src/modules/permission/enums/permission.enum";
import { UseOrPermissions } from "src/modules/permission/decorators/permission.decorator";
import { CaregiverInput } from "../dtos/caregiver.input";
import { CurrentUser } from "src/modules/auth/auth-user.decorator";
import { User } from "src/modules/user/models/user.model";
import { PermissionService } from "src/modules/permission/providers/permission.service";
import { RoleCode } from "src/modules/permission/enums/role-code.enum";


@ArgsType()
class CaregiverQuery extends QueryArgsType(Caregiver) { }

const CaregiverConnection = CaregiverQuery.ConnectionType;
@InputType()
export class CreateOneCaregiverInput extends CreateOneInputType('caregiver', CaregiverInput) { }
@InputType()
export class DeleteOneCaregiverInput extends DeleteOneInputType(Caregiver) { }

@Resolver(() => Caregiver)
@UseGuards(GqlAuthGuard, PermissionGuard)
export class CaregiverResolver {
    constructor(
        private readonly caregiverService: CaregiverService

    ) { }

    @UseOrPermissions([
        PermissionEnum.CAREGIVERS_VIEW_ALL,
        PermissionEnum.CAREGIVERS_VIEW_DEPARTMENT,
        PermissionEnum.CAREGIVERS_VIEW_ASSIGNED,
    ])
    @Query(() => CaregiverConnection)
    async caregivers(
        @Args({ type: () => CaregiverQuery }) query: CaregiverQuery,
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
            return CaregiverConnection.createFromPromise(
                (q) => this.caregiverService.query(q),
                query,
                (q) => this.caregiverService.count(q),

            );
        }

        return CaregiverConnection.createFromPromise(
            (q) => this.caregiverService.queryAssignedToCaseManager(q, currentUser.id),
            query,
            (q) => this.caregiverService.countAssignedToCaseManager(query.filter as any, currentUser.id),

        );
    }

    @Mutation(() => Caregiver)
    @UseOrPermissions([PermissionEnum.CAREGIVERS_EDIT_DEPARTMENT, PermissionEnum.CAREGIVERS_CREATE_ASSIGNED])
    async createOneCaregiver(@Args('input', { type: () => CreateOneCaregiverInput }) input: CreateOneCaregiverInput): Promise<Caregiver> {
        try {
            const caregiverInput = input['caregiver'] as CaregiverInput;
            return await this.caregiverService.insert(caregiverInput)
        } catch (error) {
            error.message = error.message === 'Conflict' ? 'This caregiver number has already been registered!' : error.message;
            return error
        }

    }
    @Mutation(() => Caregiver)
    @UseOrPermissions([
        PermissionEnum.CAREGIVERS_DELETE_ALL,
        PermissionEnum.CAREGIVERS_DELETE_DEPARTMENT,
        PermissionEnum.CAREGIVERS_DELETE_ASSIGNED,
    ])
    async deleteOneCaregiver(@Args('input', { type: () => DeleteOneCaregiverInput }) input: DeleteOneCaregiverInput): Promise<Caregiver> {
        return this.caregiverService.deleteOne(Number(input.id));
    }

}

