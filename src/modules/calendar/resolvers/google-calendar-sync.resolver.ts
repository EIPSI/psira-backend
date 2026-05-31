import { UseGuards } from '@nestjs/common';
import { Args, Field, Mutation, ObjectType, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from 'src/modules/auth/auth-user.decorator';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import { UsePermission } from 'src/modules/permission/decorators/permission.decorator';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { PermissionGuard } from 'src/modules/permission/guards/permission.guard';
import { User } from 'src/modules/user/models/user.model';
import { CalendarOccurrence } from '../models/calendar-occurrence.model';
import { GoogleCalendarConnection } from '../models/google-calendar-connection.model';
import { GoogleCalendarSyncService } from '../services/google-calendar-sync.service';

@ObjectType()
class GoogleCalendarIntegrationStatus {
    @Field()
    configured: boolean;
}

@Resolver(() => GoogleCalendarConnection)
@UseGuards(GqlAuthGuard, PermissionGuard)
export class GoogleCalendarSyncResolver {
    constructor(private readonly syncService: GoogleCalendarSyncService) {}

    @Query(() => GoogleCalendarIntegrationStatus)
    @UsePermission(PermissionEnum.VIEW_ASSESSMENTS)
    async googleCalendarIntegrationStatus(): Promise<GoogleCalendarIntegrationStatus> {
        return { configured: await this.syncService.isConfigured() };
    }

    @Query(() => String)
    @UsePermission(PermissionEnum.VIEW_ASSESSMENTS)
    googleCalendarAuthorizationUrl(@CurrentUser() currentUser: User): Promise<string> {
        return this.syncService.getAuthorizationUrl(currentUser);
    }

    @Mutation(() => GoogleCalendarConnection)
    @UsePermission(PermissionEnum.VIEW_ASSESSMENTS)
    connectGoogleCalendar(
        @Args('code') code: string,
        @CurrentUser() currentUser: User,
    ): Promise<GoogleCalendarConnection> {
        return this.syncService.connectUser(code, currentUser);
    }

    @Mutation(() => CalendarOccurrence, { nullable: true })
    @UsePermission(PermissionEnum.MANAGE_ASSESSMENTS)
    pullGoogleCalendarDateChange(
        @Args('externalEventId') externalEventId: string,
    ): Promise<CalendarOccurrence | null> {
        return this.syncService.pullExternalDateChange(externalEventId);
    }
}
