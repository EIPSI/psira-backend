import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from 'src/modules/auth/auth-user.decorator';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import { UseOrPermissions } from 'src/modules/permission/decorators/permission.decorator';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { PermissionGuard } from 'src/modules/permission/guards/permission.guard';
import { User } from 'src/modules/user/models/user.model';
import {
    CreateInformedConsentModelInput,
    CreateInformedConsentVersionInput,
    UpdateInformedConsentModelInput,
} from '../dtos/informed-consent-model.input';
import { InformedConsentShortcutDto } from '../dtos/informed-consent-shortcut.dto';
import { InformedConsentModel } from '../models/informed-consent-model.model';
import { InformedConsentVersion } from '../models/informed-consent-version.model';
import { InformedConsentModelService } from '../services/informed-consent-model.service';

@Resolver(() => InformedConsentModel)
@UseGuards(GqlAuthGuard, PermissionGuard)
export class InformedConsentModelResolver {
    constructor(private readonly modelService: InformedConsentModelService) {}

    @Query(() => [InformedConsentModel])
    @UseOrPermissions([
        PermissionEnum.INFORMED_CONSENT_MODELS_VIEW_DEPARTMENT,
        PermissionEnum.INFORMED_CONSENT_MODELS_EDIT_DEPARTMENT,
    ])
    informedConsentModels(): Promise<InformedConsentModel[]> {
        return this.modelService.list();
    }

    @Query(() => InformedConsentModel)
    @UseOrPermissions([
        PermissionEnum.INFORMED_CONSENT_MODELS_VIEW_DEPARTMENT,
        PermissionEnum.INFORMED_CONSENT_MODELS_EDIT_DEPARTMENT,
    ])
    informedConsentModel(
        @Args('id', { type: () => Int }) id: number,
    ): Promise<InformedConsentModel> {
        return this.modelService.get(id);
    }

    @Query(() => [InformedConsentShortcutDto])
    @UseOrPermissions([
        PermissionEnum.INFORMED_CONSENT_MODELS_VIEW_DEPARTMENT,
        PermissionEnum.INFORMED_CONSENT_MODELS_EDIT_DEPARTMENT,
    ])
    informedConsentShortcuts(): InformedConsentShortcutDto[] {
        return this.modelService.shortcuts();
    }

    @Mutation(() => InformedConsentModel)
    @UseOrPermissions([PermissionEnum.INFORMED_CONSENT_MODELS_EDIT_DEPARTMENT])
    createInformedConsentModel(
        @Args('input') input: CreateInformedConsentModelInput,
        @CurrentUser() currentUser: User,
    ): Promise<InformedConsentModel> {
        return this.modelService.create(input, currentUser);
    }

    @Mutation(() => InformedConsentModel)
    @UseOrPermissions([PermissionEnum.INFORMED_CONSENT_MODELS_EDIT_DEPARTMENT])
    updateInformedConsentModel(
        @Args('input') input: UpdateInformedConsentModelInput,
    ): Promise<InformedConsentModel> {
        return this.modelService.update(input);
    }

    @Mutation(() => InformedConsentVersion)
    @UseOrPermissions([PermissionEnum.INFORMED_CONSENT_MODELS_EDIT_DEPARTMENT])
    createInformedConsentVersion(
        @Args('input') input: CreateInformedConsentVersionInput,
        @CurrentUser() currentUser: User,
    ): Promise<InformedConsentVersion> {
        return this.modelService.createVersion(input, currentUser);
    }

    @Mutation(() => InformedConsentModel)
    @UseOrPermissions([PermissionEnum.INFORMED_CONSENT_MODELS_EDIT_DEPARTMENT])
    publishInformedConsentVersion(
        @Args('versionId', { type: () => Int }) versionId: number,
    ): Promise<InformedConsentModel> {
        return this.modelService.publishVersion(versionId);
    }

    @Mutation(() => Boolean)
    @UseOrPermissions([PermissionEnum.INFORMED_CONSENT_MODELS_EDIT_DEPARTMENT])
    deleteInformedConsentModel(
        @Args('id', { type: () => Int }) id: number,
    ): Promise<boolean> {
        return this.modelService.delete(id);
    }

    @Mutation(() => InformedConsentModel)
    @UseOrPermissions([PermissionEnum.INFORMED_CONSENT_MODELS_EDIT_DEPARTMENT])
    duplicateInformedConsentModel(
        @Args('id', { type: () => Int }) id: number,
        @CurrentUser() currentUser: User,
    ): Promise<InformedConsentModel> {
        return this.modelService.duplicate(id, currentUser);
    }
}
