import { NestjsQueryGraphQLModule } from '@nestjs-query/query-graphql';
import { NestjsQueryTypeOrmModule } from '@nestjs-query/query-typeorm';
import { Module } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/guards/permission.guard';
import { AssessmentModule } from '../assessment/assessment.module';
import { Assessment } from '../assessment/models/assessment.model';
import { ClinicalSessionResource } from '../clinical-session/models/clinical-session-resource.model';
import { SettingModule } from '../setting/setting.module';
import { ClinicalSession } from '../clinical-session/models/clinical-session.model';
import { User } from '../user/models/user.model';
import { CalendarExternalEvent } from './models/calendar-external-event.model';
import { CalendarOccurrence } from './models/calendar-occurrence.model';
import { GoogleCalendarConnection } from './models/google-calendar-connection.model';
import { CalendarEventResolver } from './resolvers/calendar-event.resolver';
import { CalendarOccurrenceResolver } from './resolvers/calendar-occurrence.resolver';
import { GoogleCalendarSyncResolver } from './resolvers/google-calendar-sync.resolver';
import { CalendarEventService } from './services/calendar-event.service';
import { CalendarOccurrenceService } from './services/calendar-occurrence.service';
import { GoogleCalendarHttpService } from './services/google-calendar-http.service';
import { GoogleCalendarSyncService } from './services/google-calendar-sync.service';

const guards = [GqlAuthGuard, PermissionGuard];

@Module({
    imports: [
        AssessmentModule,
        SettingModule,
        NestjsQueryGraphQLModule.forFeature({
            imports: [
                NestjsQueryTypeOrmModule.forFeature([
                    CalendarOccurrence,
                    CalendarExternalEvent,
                    GoogleCalendarConnection,
                    Assessment,
                    ClinicalSession,
                    ClinicalSessionResource,
                    User,
                ]),
            ],
            resolvers: [
                {
                    DTOClass: CalendarOccurrence,
                    EntityClass: CalendarOccurrence,
                    guards,
                    read: { disabled: true },
                    create: { disabled: true },
                    update: { disabled: true },
                    delete: { disabled: true },
                },
                {
                    DTOClass: GoogleCalendarConnection,
                    EntityClass: GoogleCalendarConnection,
                    guards,
                    read: { disabled: false },
                    create: { disabled: true },
                    update: { disabled: true },
                    delete: { disabled: true },
                },
            ],
        }),
    ],
    providers: [
        CalendarEventService,
        CalendarEventResolver,
        CalendarOccurrenceService,
        CalendarOccurrenceResolver,
        GoogleCalendarHttpService,
        GoogleCalendarSyncService,
        GoogleCalendarSyncResolver,
    ],
    exports: [CalendarOccurrenceService, GoogleCalendarSyncService],
})
export class CalendarModule {}
