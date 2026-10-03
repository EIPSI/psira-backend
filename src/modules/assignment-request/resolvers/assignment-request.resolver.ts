import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from 'src/modules/auth/auth-user.decorator';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/modules/user/models/user.model';
import { AssignmentRequest } from '../models/assignment-request.model';
import { AssignmentRequestService } from '../services/assignment-request.service';

@Resolver(() => AssignmentRequest)
@UseGuards(GqlAuthGuard)
export class AssignmentRequestResolver {
    constructor(private readonly assignmentRequestService: AssignmentRequestService) {}

    @Query(() => [AssignmentRequest])
    pendingAssignmentRequests(@CurrentUser() currentUser: User): Promise<AssignmentRequest[]> {
        return this.assignmentRequestService.pendingForAssignee(currentUser.id);
    }

    @Query(() => [AssignmentRequest])
    pendingPatientCaseManagerRequests(
        @Args({ name: 'patientId', type: () => Int }) patientId: number,
    ): Promise<AssignmentRequest[]> {
        return this.assignmentRequestService.pendingCaseManagerRequests(patientId);
    }

    @Query(() => [AssignmentRequest])
    pendingTherapistSupervisorRequests(
        @Args({ name: 'therapistId', type: () => Int }) therapistId: number,
    ): Promise<AssignmentRequest[]> {
        return this.assignmentRequestService.pendingSupervisorRequests(therapistId);
    }

    @Mutation(() => AssignmentRequest)
    acceptAssignmentRequest(
        @Args({ name: 'id', type: () => Int }) id: number,
        @CurrentUser() currentUser: User,
    ): Promise<AssignmentRequest> {
        return this.assignmentRequestService.accept(id, currentUser.id);
    }

    @Mutation(() => AssignmentRequest)
    rejectAssignmentRequest(
        @Args({ name: 'id', type: () => Int }) id: number,
        @CurrentUser() currentUser: User,
    ): Promise<AssignmentRequest> {
        return this.assignmentRequestService.reject(id, currentUser.id);
    }

    @Mutation(() => AssignmentRequest)
    cancelAssignmentRequest(
        @Args({ name: 'id', type: () => Int }) id: number,
        @CurrentUser() currentUser: User,
    ): Promise<AssignmentRequest> {
        return this.assignmentRequestService.cancel(id, currentUser.id);
    }
}
