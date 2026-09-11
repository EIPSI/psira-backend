import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from 'src/modules/auth/auth-user.decorator';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import {
    UseOrPermissions,
    UsePermission,
} from 'src/modules/permission/decorators/permission.decorator';
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
    @UseOrPermissions([
        PermissionEnum.THERAPISTS_VIEW_ALL,
        PermissionEnum.THERAPISTS_VIEW_DEPARTMENT,
        PermissionEnum.THERAPISTS_VIEW_ASSIGNED,
    ])
    therapists(@Args() filter: SupervisionFilter, @CurrentUser() currentUser: User): Promise<UserConnectionDto> {
        return this.therapistSupervisionService.getTherapists(filter, currentUser);
    }

    @Query(() => UserConnectionDto)
    @UseOrPermissions([
        PermissionEnum.SUPERVISORS_VIEW_ALL,
        PermissionEnum.SUPERVISORS_VIEW_DEPARTMENT,
    ])
    supervisors(@Args() filter: SupervisionFilter, @CurrentUser() currentUser: User): Promise<UserConnectionDto> {
        return this.therapistSupervisionService.getSupervisors(filter, currentUser);
    }

    @Mutation(() => Boolean)
    @UseOrPermissions([
        PermissionEnum.THERAPISTS_EDIT_ALL,
        PermissionEnum.THERAPISTS_EDIT_DEPARTMENT,
        PermissionEnum.SUPERVISORS_EDIT_ALL,
        PermissionEnum.SUPERVISORS_EDIT_DEPARTMENT,
    ])
    assignTherapistSupervisor(
        @Args({ name: 'therapistId', type: () => Int }) therapistId: number,
        @Args({ name: 'supervisorId', type: () => Int }) supervisorId: number,
    ): Promise<boolean> {
        return this.therapistSupervisionService.assignTherapistSupervisor(therapistId, supervisorId);
    }

    @Mutation(() => Boolean)
    @UseOrPermissions([
        PermissionEnum.THERAPISTS_EDIT_ALL,
        PermissionEnum.THERAPISTS_EDIT_DEPARTMENT,
        PermissionEnum.SUPERVISORS_EDIT_ALL,
        PermissionEnum.SUPERVISORS_EDIT_DEPARTMENT,
    ])
    unassignTherapistSupervisor(
        @Args({ name: 'therapistId', type: () => Int }) therapistId: number,
        @Args({ name: 'supervisorId', type: () => Int }) supervisorId: number,
    ): Promise<boolean> {
        return this.therapistSupervisionService.unassignTherapistSupervisor(therapistId, supervisorId);
    }

    @Mutation(() => Boolean)
    @UseOrPermissions([
        PermissionEnum.PATIENTS_EDIT_ALL,
        PermissionEnum.PATIENTS_EDIT_DEPARTMENT,
        PermissionEnum.PATIENTS_EDIT_ASSIGNED,
    ])
    assignSupervisorPatientVisibility(
        @Args({ name: 'therapistId', type: () => Int }) therapistId: number,
        @Args({ name: 'supervisorId', type: () => Int }) supervisorId: number,
        @Args({ name: 'patientId', type: () => Int }) patientId: number,
    ): Promise<boolean> {
        return this.therapistSupervisionService.assignSupervisorPatientVisibility(therapistId, supervisorId, patientId);
    }

    @Mutation(() => Boolean)
    @UseOrPermissions([
        PermissionEnum.PATIENTS_EDIT_ALL,
        PermissionEnum.PATIENTS_EDIT_DEPARTMENT,
        PermissionEnum.PATIENTS_EDIT_ASSIGNED,
    ])
    unassignSupervisorPatientVisibility(
        @Args({ name: 'therapistId', type: () => Int }) therapistId: number,
        @Args({ name: 'supervisorId', type: () => Int }) supervisorId: number,
        @Args({ name: 'patientId', type: () => Int }) patientId: number,
    ): Promise<boolean> {
        return this.therapistSupervisionService.unassignSupervisorPatientVisibility(therapistId, supervisorId, patientId);
    }

    @Query(() => [Patient])
    @UseOrPermissions([
        PermissionEnum.PATIENTS_VIEW_ALL,
        PermissionEnum.PATIENTS_VIEW_DEPARTMENT,
        PermissionEnum.PATIENTS_VIEW_ASSIGNED,
    ])
    supervisorVisiblePatients(
        @Args({ name: 'therapistId', type: () => Int }) therapistId: number,
        @Args({ name: 'supervisorId', type: () => Int }) supervisorId: number,
    ): Promise<Patient[]> {
        return this.therapistSupervisionService.getSupervisorVisiblePatients(therapistId, supervisorId);
    }
}
