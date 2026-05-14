import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from 'src/modules/auth/auth-user.decorator';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import { UsePermission } from 'src/modules/permission/decorators/permission.decorator';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { PermissionGuard } from 'src/modules/permission/guards/permission.guard';
import { Patient } from 'src/modules/patient/models/patient.model';
import { SupervisionFilter } from '../dto/supervision.filter';
import { UserConnectionDto } from '../dto/user-connection.model';
import { User } from '../models/user.model';
import { TherapistSupervisionService } from '../services/therapist-supervision.service';

@Resolver(() => User)
@UseGuards(GqlAuthGuard, PermissionGuard)
export class TherapistSupervisionResolver {
    constructor(private readonly therapistSupervisionService: TherapistSupervisionService) {}

    @Query(() => UserConnectionDto)
    @UsePermission(PermissionEnum.VIEW_USERS)
    therapists(@Args() filter: SupervisionFilter, @CurrentUser() currentUser: User): Promise<UserConnectionDto> {
        return this.therapistSupervisionService.getTherapists(filter, currentUser);
    }

    @Query(() => UserConnectionDto)
    @UsePermission(PermissionEnum.VIEW_USERS)
    supervisors(@Args() filter: SupervisionFilter, @CurrentUser() currentUser: User): Promise<UserConnectionDto> {
        return this.therapistSupervisionService.getSupervisors(filter, currentUser);
    }

    @Mutation(() => Boolean)
    @UsePermission(PermissionEnum.MANAGE_USERS)
    assignTherapistSupervisor(
        @Args({ name: 'therapistId', type: () => Int }) therapistId: number,
        @Args({ name: 'supervisorId', type: () => Int }) supervisorId: number,
    ): Promise<boolean> {
        return this.therapistSupervisionService.assignTherapistSupervisor(therapistId, supervisorId);
    }

    @Mutation(() => Boolean)
    @UsePermission(PermissionEnum.MANAGE_USERS)
    unassignTherapistSupervisor(
        @Args({ name: 'therapistId', type: () => Int }) therapistId: number,
        @Args({ name: 'supervisorId', type: () => Int }) supervisorId: number,
    ): Promise<boolean> {
        return this.therapistSupervisionService.unassignTherapistSupervisor(therapistId, supervisorId);
    }

    @Mutation(() => Boolean)
    @UsePermission(PermissionEnum.MANAGE_PATIENTS)
    assignSupervisorPatientVisibility(
        @Args({ name: 'therapistId', type: () => Int }) therapistId: number,
        @Args({ name: 'supervisorId', type: () => Int }) supervisorId: number,
        @Args({ name: 'patientId', type: () => Int }) patientId: number,
    ): Promise<boolean> {
        return this.therapistSupervisionService.assignSupervisorPatientVisibility(therapistId, supervisorId, patientId);
    }

    @Mutation(() => Boolean)
    @UsePermission(PermissionEnum.MANAGE_PATIENTS)
    unassignSupervisorPatientVisibility(
        @Args({ name: 'therapistId', type: () => Int }) therapistId: number,
        @Args({ name: 'supervisorId', type: () => Int }) supervisorId: number,
        @Args({ name: 'patientId', type: () => Int }) patientId: number,
    ): Promise<boolean> {
        return this.therapistSupervisionService.unassignSupervisorPatientVisibility(therapistId, supervisorId, patientId);
    }

    @Query(() => [Patient])
    @UsePermission(PermissionEnum.VIEW_PATIENTS)
    supervisorVisiblePatients(
        @Args({ name: 'therapistId', type: () => Int }) therapistId: number,
        @Args({ name: 'supervisorId', type: () => Int }) supervisorId: number,
    ): Promise<Patient[]> {
        return this.therapistSupervisionService.getSupervisorVisiblePatients(therapistId, supervisorId);
    }
}
