import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from 'src/modules/auth/auth-user.decorator';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import { UseOrPermissions } from 'src/modules/permission/decorators/permission.decorator';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { PermissionGuard } from 'src/modules/permission/guards/permission.guard';
import { User } from 'src/modules/user/models/user.model';
import { CalendarEventFilterInput } from '../dtos/calendar-event.input';
import { CalendarEvent } from '../models/calendar-event.model';
import { CalendarEventService } from '../services/calendar-event.service';

@Resolver(() => CalendarEvent)
@UseGuards(GqlAuthGuard, PermissionGuard)
export class CalendarEventResolver {
    constructor(private readonly calendarEventService: CalendarEventService) {}

    @Query(() => [CalendarEvent])
    @UseOrPermissions([
        PermissionEnum.CLINICAL_VIEW_ALL,
        PermissionEnum.CLINICAL_VIEW_DEPARTMENT,
        PermissionEnum.CLINICAL_VIEW_ASSIGNED,
        PermissionEnum.ASSESSMENTS_VIEW_ALL,
        PermissionEnum.ASSESSMENTS_VIEW_DEPARTMENT,
        PermissionEnum.ASSESSMENTS_VIEW_ASSIGNED,
    ])
    calendarEvents(
        @Args('filter', { type: () => CalendarEventFilterInput })
        filter: CalendarEventFilterInput,
        @CurrentUser() currentUser: User,
    ): Promise<CalendarEvent[]> {
        return this.calendarEventService.getCalendarEvents(filter, currentUser);
    }
}
