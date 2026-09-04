import { UseGuards } from '@nestjs/common';
import {
    Args,
    GraphQLISODateTime,
    Int,
    Mutation,
    Query,
    Resolver,
} from '@nestjs/graphql';
import { CurrentUser } from 'src/modules/auth/auth-user.decorator';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import { CreateFullAssessmentInput } from 'src/modules/assessment/dtos/create-assessment.input';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { UsePermission } from 'src/modules/permission/decorators/permission.decorator';
import { PermissionGuard } from 'src/modules/permission/guards/permission.guard';
import { User } from 'src/modules/user/models/user.model';
import { CalendarOccurrenceType } from '../enums/calendar-occurrence-type.enum';
import { CalendarOccurrence } from '../models/calendar-occurrence.model';
import { CalendarOccurrenceService } from '../services/calendar-occurrence.service';

@Resolver(() => CalendarOccurrence)
@UseGuards(GqlAuthGuard, PermissionGuard)
export class CalendarOccurrenceResolver {
    constructor(
        private readonly calendarOccurrenceService: CalendarOccurrenceService,
    ) {}

    @Query(() => [CalendarOccurrence])
    calendarOccurrences(
        @Args('from', { type: () => GraphQLISODateTime }) from: Date,
        @Args('to', { type: () => GraphQLISODateTime }) to: Date,
        @CurrentUser() currentUser: User,
        @Args('patientId', { type: () => Int, nullable: true }) patientId?: number,
        @Args('therapistId', { type: () => Int, nullable: true }) therapistId?: number,
        @Args('supervisorId', { type: () => Int, nullable: true }) supervisorId?: number,
        @Args('occurrenceType', {
            type: () => CalendarOccurrenceType,
            nullable: true,
        })
        occurrenceType?: CalendarOccurrenceType,
    ): Promise<CalendarOccurrence[]> {
        return this.calendarOccurrenceService.getOccurrences(
            from,
            to,
            currentUser,
            { patientId, therapistId, supervisorId, occurrenceType },
        );
    }

    @Mutation(() => CalendarOccurrence)
    @UsePermission(PermissionEnum.CLINICAL_EDIT_DEPARTMENT)
    moveCalendarOccurrence(
        @Args('id', { type: () => Int }) id: number,
        @Args('startAt', { type: () => GraphQLISODateTime }) startAt: Date,
        @Args('endAt', { type: () => GraphQLISODateTime }) endAt: Date,
    ): Promise<CalendarOccurrence> {
        return this.calendarOccurrenceService.detachAndMoveOccurrence(
            id,
            startAt,
            endAt,
        );
    }

    @Mutation(() => CalendarOccurrence)
    @UsePermission(PermissionEnum.CLINICAL_EDIT_DEPARTMENT)
    createAssessmentOccurrence(
        @Args('assessment') assessment: CreateFullAssessmentInput,
        @CurrentUser() currentUser: User,
    ): Promise<CalendarOccurrence> {
        return this.calendarOccurrenceService.createAssessmentOccurrence(
            assessment,
            currentUser,
        );
    }
}
