import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from 'src/modules/auth/auth-user.decorator';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import { UseOrPermissions } from 'src/modules/permission/decorators/permission.decorator';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { PermissionGuard } from 'src/modules/permission/guards/permission.guard';
import { User } from 'src/modules/user/models/user.model';
import {
    CreateInformedConsentManagementInput,
    UpdateInformedConsentManagementInput,
} from '../dtos/informed-consent-management.input';
import { InformedConsentManagement } from '../models/informed-consent-management.model';
import { InformedConsentManagementService } from '../services/informed-consent-management.service';

@Resolver(() => InformedConsentManagement)
@UseGuards(GqlAuthGuard, PermissionGuard)
export class InformedConsentManagementResolver {
    constructor(private readonly managementService: InformedConsentManagementService) {}

    @Query(() => [InformedConsentManagement])
    @UseOrPermissions([
        PermissionEnum.INFORMED_CONSENT_MANAGEMENT_VIEW_DEPARTMENT,
        PermissionEnum.INFORMED_CONSENT_MANAGEMENT_EDIT_DEPARTMENT,
    ])
    informedConsentManagements(): Promise<InformedConsentManagement[]> {
        return this.managementService.list();
    }

    @Query(() => InformedConsentManagement)
    @UseOrPermissions([
        PermissionEnum.INFORMED_CONSENT_MANAGEMENT_VIEW_DEPARTMENT,
        PermissionEnum.INFORMED_CONSENT_MANAGEMENT_EDIT_DEPARTMENT,
    ])
    informedConsentManagement(
        @Args('id', { type: () => Int }) id: number,
    ): Promise<InformedConsentManagement> {
        return this.managementService.get(id);
    }

    @Mutation(() => InformedConsentManagement)
    @UseOrPermissions([PermissionEnum.INFORMED_CONSENT_MANAGEMENT_EDIT_DEPARTMENT])
    createInformedConsentManagement(
        @Args('input') input: CreateInformedConsentManagementInput,
        @CurrentUser() currentUser: User,
    ): Promise<InformedConsentManagement> {
        return this.managementService.create(input, currentUser);
    }

    @Mutation(() => InformedConsentManagement)
    @UseOrPermissions([PermissionEnum.INFORMED_CONSENT_MANAGEMENT_EDIT_DEPARTMENT])
    updateInformedConsentManagement(
        @Args('input') input: UpdateInformedConsentManagementInput,
    ): Promise<InformedConsentManagement> {
        return this.managementService.update(input);
    }

    @Mutation(() => InformedConsentManagement)
    @UseOrPermissions([PermissionEnum.INFORMED_CONSENT_MANAGEMENT_EDIT_DEPARTMENT])
    duplicateInformedConsentManagement(
        @Args('id', { type: () => Int }) id: number,
        @CurrentUser() currentUser: User,
    ): Promise<InformedConsentManagement> {
        return this.managementService.duplicate(id, currentUser);
    }

    @Mutation(() => Boolean)
    @UseOrPermissions([PermissionEnum.INFORMED_CONSENT_MANAGEMENT_EDIT_DEPARTMENT])
    deleteInformedConsentManagement(
        @Args('id', { type: () => Int }) id: number,
    ): Promise<boolean> {
        return this.managementService.delete(id);
    }
}
