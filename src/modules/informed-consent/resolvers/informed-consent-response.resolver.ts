import { UseGuards } from '@nestjs/common';
import { Args, Context, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from 'src/modules/auth/auth-user.decorator';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import { UseOrPermissions } from 'src/modules/permission/decorators/permission.decorator';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { PermissionGuard } from 'src/modules/permission/guards/permission.guard';
import { User } from 'src/modules/user/models/user.model';
import { PendingInformedConsentDto } from '../dtos/pending-informed-consent.dto';
import {
    CancelInformedConsentReactivationInput,
    ReviewInformedConsentResponseInput,
    SubmitInformedConsentResponseInput,
} from '../dtos/informed-consent-response.input';
import { InformedConsentResponse } from '../models/informed-consent-response.model';
import { InformedConsentModel } from '../models/informed-consent-model.model';
import { InformedConsentResponseService } from '../services/informed-consent-response.service';

@Resolver(() => InformedConsentResponse)
@UseGuards(GqlAuthGuard, PermissionGuard)
export class InformedConsentResponseResolver {
    constructor(private readonly responseService: InformedConsentResponseService) {}

    @Query(() => [PendingInformedConsentDto])
    pendingInformedConsents(
        @CurrentUser() currentUser: User,
    ): Promise<PendingInformedConsentDto[]> {
        return this.responseService.pendingForUser(currentUser.id);
    }

    @Query(() => [InformedConsentResponse])
    @UseOrPermissions([
        PermissionEnum.VIEW_INFORMED_CONSENT_RESPONSES,
        PermissionEnum.REVIEW_INFORMED_CONSENT_RESPONSES,
    ])
    informedConsentResponses(): Promise<InformedConsentResponse[]> {
        return this.responseService.listResponses();
    }

    @Query(() => [InformedConsentResponse])
    myInformedConsentResponses(
        @CurrentUser() currentUser: User,
    ): Promise<InformedConsentResponse[]> {
        return this.responseService.listResponsesForUser(currentUser.id);
    }

    @Query(() => InformedConsentModel)
    pendingInformedConsentModel(
        @Args('id', { type: () => Int }) id: number,
        @CurrentUser() currentUser: User,
    ): Promise<InformedConsentModel> {
        return this.responseService.getPendingModelForUser(currentUser.id, id);
    }

    @Query(() => InformedConsentResponse)
    @UseOrPermissions([
        PermissionEnum.VIEW_INFORMED_CONSENT_RESPONSES,
        PermissionEnum.REVIEW_INFORMED_CONSENT_RESPONSES,
    ])
    informedConsentResponse(
        @Args('id', { type: () => Int }) id: number,
    ): Promise<InformedConsentResponse> {
        return this.responseService.getResponse(id);
    }

    @Mutation(() => InformedConsentResponse)
    submitInformedConsentResponse(
        @Args('input') input: SubmitInformedConsentResponseInput,
        @CurrentUser() currentUser: User,
        @Context() context: any,
    ): Promise<InformedConsentResponse> {
        return this.responseService.submit(input, currentUser, context?.req);
    }

    @Mutation(() => InformedConsentResponse)
    reactivateInformedConsentResponse(
        @Args('input') input: ReviewInformedConsentResponseInput,
        @CurrentUser() currentUser: User,
    ): Promise<InformedConsentResponse> {
        return this.responseService.reactivate(input, currentUser);
    }

    @Mutation(() => InformedConsentResponse)
    reactivateMyInformedConsentResponse(
        @Args('input') input: ReviewInformedConsentResponseInput,
        @CurrentUser() currentUser: User,
    ): Promise<InformedConsentResponse> {
        return this.responseService.reactivateOwn(input, currentUser);
    }

    @Mutation(() => InformedConsentResponse)
    cancelMyInformedConsentReactivation(
        @Args('input') input: CancelInformedConsentReactivationInput,
        @CurrentUser() currentUser: User,
    ): Promise<InformedConsentResponse> {
        return this.responseService.cancelReactivationOwn(input, currentUser);
    }

    @Mutation(() => InformedConsentResponse)
    @UseOrPermissions([
        PermissionEnum.REVIEW_INFORMED_CONSENT_RESPONSES,
        PermissionEnum.MANAGE_PATIENTS,
        PermissionEnum.MANAGE_USERS,
    ])
    revokeInformedConsentResponse(
        @Args('input') input: ReviewInformedConsentResponseInput,
        @CurrentUser() currentUser: User,
    ): Promise<InformedConsentResponse> {
        return this.responseService.revoke(input, currentUser);
    }
}
