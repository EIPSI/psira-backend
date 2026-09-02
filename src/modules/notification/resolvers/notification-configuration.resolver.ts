import { ForbiddenException, UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { InjectRepository } from '@nestjs/typeorm';
import { CurrentUser } from 'src/modules/auth/auth-user.decorator';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import { UseOrPermissions } from 'src/modules/permission/decorators/permission.decorator';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { PermissionGuard } from 'src/modules/permission/guards/permission.guard';
import { User } from 'src/modules/user/models/user.model';
import {
    CreateNotificationConfigurationInput,
    UpdateNotificationConfigurationInput,
} from '../dtos/notification-configuration.input';
import {
    NotificationPreferenceQueryInput,
    UpdateNotificationPreferenceInput,
} from '../dtos/notification-preference.input';
import { NotificationTemplateShortcutDto } from '../dtos/notification-template-shortcut.dto';
import { NotificationConfiguration } from '../models/notification-configuration.model';
import { NotificationPreference } from '../models/notification-preference.model';
import { NotificationConfigurationService } from '../services/notification-configuration.service';
import { NotificationPreferenceService } from '../services/notification-preference.service';
import { Repository } from 'typeorm';

@Resolver(() => NotificationConfiguration)
@UseGuards(GqlAuthGuard, PermissionGuard)
export class NotificationConfigurationResolver {
    constructor(
        private readonly notificationConfigurationService: NotificationConfigurationService,
        private readonly notificationPreferenceService: NotificationPreferenceService,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) {}

    @Query(() => [NotificationConfiguration])
    @UseOrPermissions([
        PermissionEnum.VIEW_NOTIFICATIONS,
        PermissionEnum.MANAGE_NOTIFICATIONS,
        PermissionEnum.VIEW_TEMPLATES,
        PermissionEnum.MANAGE_TEMPLATES,
    ])
    notificationConfigurations(): Promise<NotificationConfiguration[]> {
        return this.notificationConfigurationService.list();
    }

    @Query(() => NotificationConfiguration)
    @UseOrPermissions([
        PermissionEnum.VIEW_NOTIFICATIONS,
        PermissionEnum.MANAGE_NOTIFICATIONS,
        PermissionEnum.VIEW_TEMPLATES,
        PermissionEnum.MANAGE_TEMPLATES,
    ])
    notificationConfiguration(
        @Args('id', { type: () => Int }) id: number,
    ): Promise<NotificationConfiguration> {
        return this.notificationConfigurationService.get(id);
    }

    @Query(() => [NotificationTemplateShortcutDto])
    @UseOrPermissions([
        PermissionEnum.VIEW_NOTIFICATIONS,
        PermissionEnum.MANAGE_NOTIFICATIONS,
        PermissionEnum.VIEW_TEMPLATES,
        PermissionEnum.MANAGE_TEMPLATES,
    ])
    notificationTemplateShortcuts(): NotificationTemplateShortcutDto[] {
        return this.notificationConfigurationService.templateShortcuts();
    }

    @Query(() => NotificationPreference)
    notificationPreference(
        @Args('input') input: NotificationPreferenceQueryInput,
        @CurrentUser() currentUser: User,
    ): Promise<NotificationPreference> {
        this.assertOwnUserPreference(input, currentUser);
        return this.notificationPreferenceService.getOrCreate(input);
    }

    @Mutation(() => NotificationConfiguration)
    @UseOrPermissions([
        PermissionEnum.MANAGE_NOTIFICATIONS,
        PermissionEnum.MANAGE_TEMPLATES,
    ])
    createNotificationConfiguration(
        @Args('input') input: CreateNotificationConfigurationInput,
    ): Promise<NotificationConfiguration> {
        return this.notificationConfigurationService.create(input);
    }

    @Mutation(() => NotificationConfiguration)
    @UseOrPermissions([
        PermissionEnum.MANAGE_NOTIFICATIONS,
        PermissionEnum.MANAGE_TEMPLATES,
    ])
    updateNotificationConfiguration(
        @Args('input') input: UpdateNotificationConfigurationInput,
    ): Promise<NotificationConfiguration> {
        return this.notificationConfigurationService.update(input);
    }

    @Mutation(() => Boolean)
    @UseOrPermissions([
        PermissionEnum.MANAGE_NOTIFICATIONS,
        PermissionEnum.MANAGE_TEMPLATES,
    ])
    deleteNotificationConfiguration(
        @Args('id', { type: () => Int }) id: number,
    ): Promise<boolean> {
        return this.notificationConfigurationService.delete(id);
    }

    @Mutation(() => NotificationPreference)
    updateNotificationPreference(
        @Args('input') input: UpdateNotificationPreferenceInput,
        @CurrentUser() currentUser: User,
    ): Promise<NotificationPreference> {
        return this.updatePreferenceWithAccess(input, currentUser);
    }

    private async updatePreferenceWithAccess(
        input: UpdateNotificationPreferenceInput,
        currentUser: User,
    ): Promise<NotificationPreference> {
        await this.assertCanEditPreference(input, currentUser);
        return this.notificationPreferenceService.update(input);
    }

    private assertOwnUserPreference(
        input: NotificationPreferenceQueryInput,
        currentUser: User,
    ): void {
        if (input.userId && Number(input.userId) !== Number(currentUser.id)) {
            throw new ForbiddenException('User notification preferences can only be edited by the same user.');
        }
    }

    private async assertCanEditPreference(
        input: NotificationPreferenceQueryInput,
        currentUser: User,
    ): Promise<void> {
        if (input.userId) {
            this.assertOwnUserPreference(input, currentUser);
            return;
        }
        const user = await this.userRepository.findOne(currentUser.id, {
            relations: ['roles', 'roles.permissions'],
        });
        const permissionNames = (user?.roles ?? [])
            .flatMap(role => role.permissions ?? [])
            .map(permission => permission.name);
        const allowed = [
            PermissionEnum.MANAGE_NOTIFICATIONS,
            PermissionEnum.MANAGE_PATIENTS,
            PermissionEnum.MANAGE_USERS,
        ].some(permission => permissionNames.includes(permission));
        if (!allowed) {
            throw new ForbiddenException(
                "At least one of the permissions 'manage notifications, manage patients, manage users' is required to access this resource",
            );
        }
    }
}
