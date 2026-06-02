import { UseGuards } from "@nestjs/common";
import { Args, Int, Mutation, Query, Resolver } from "@nestjs/graphql";
import { GqlAuthGuard } from "src/modules/auth/auth.guard";
import { UsePermission } from "src/modules/permission/decorators/permission.decorator";
import { PermissionEnum } from "src/modules/permission/enums/permission.enum";
import { PermissionGuard } from "src/modules/permission/guards/permission.guard";
import { CurrentUser } from "src/modules/auth/auth-user.decorator";
import { User } from "src/modules/user/models/user.model";
import { UserConnectionDto } from "src/modules/user/dto/user-connection.model";
import { CaseManagerFilter } from "../dto/case-manager.filter";
import { Patient } from "../models/patient.model";
import { CaseManagerService } from "../providers/case-manager.service";

@Resolver(() => Patient)
@UseGuards(GqlAuthGuard, PermissionGuard)
export class CaseManagerResolver {

    constructor(
        private readonly caseManagerService: CaseManagerService,
    ) { }

    @Mutation(() => Boolean)
    @UsePermission(PermissionEnum.MANAGE_PATIENTS)
    assignPatientCaseManager(
        @Args({ name: 'patientId', type: () => Int }) patientId: number,
        @Args({ name: 'userId', type: () => Int }) clinicianId: number,
        @CurrentUser() currentUser: User,
    ): Promise<boolean> {

        return this.caseManagerService.assignPatientCaseManager(patientId, clinicianId, currentUser.id);
    }

    @Mutation(() => Boolean)
    @UsePermission(PermissionEnum.MANAGE_PATIENTS)
    unassignPatientCaseManager(
        @Args({ name: 'patientId', type: () => Int }) patientId: number,
        @Args({ name: 'userId', type: () => Int }) clinicianId: number,
    ): Promise<boolean> {
        return this.caseManagerService.unassignPatientCaseManager(patientId, clinicianId);
    }


    @Query(() => UserConnectionDto)
    @UsePermission(PermissionEnum.VIEW_PATIENTS)
    getPatientCaseManagers(
        @Args() caseManagerFilter: CaseManagerFilter,
    ): Promise<UserConnectionDto> {
        return this.caseManagerService.getPatientCaseManagers(caseManagerFilter);
    }
}
