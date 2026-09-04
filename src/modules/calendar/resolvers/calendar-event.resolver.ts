import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import { UsePermission } from 'src/modules/permission/decorators/permission.decorator';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { PermissionGuard } from 'src/modules/permission/guards/permission.guard';
import { CalendarEventFilterInput } from '../dtos/calendar-event.input';
import { CalendarEvent } from '../models/calendar-event.model';
import { CalendarEventService } from '../services/calendar-event.service';

@Resolver(() => CalendarEvent)
@UseGuards(GqlAuthGuard, PermissionGuard)
export class CalendarEventResolver {
    constructor(private readonly calendarEventService: CalendarEventService) {}

    @Query(() => [CalendarEvent])
    @UsePermission(PermissionEnum.CLINICAL_VIEW_DEPARTMENT)
    calendarEvents(
        @Args('filter', { type: () => CalendarEventFilterInput })
        filter: CalendarEventFilterInput,
    ): Promise<CalendarEvent[]> {
        return this.calendarEventService.getCalendarEvents(filter);
    }
}
