import { NestjsQueryGraphQLModule } from '@nestjs-query/query-graphql';
import { NestjsQueryTypeOrmModule } from '@nestjs-query/query-typeorm';
import { Module } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/guards/permission.guard';
import { AssessmentModule } from '../assessment/assessment.module';
import { Assessment } from '../assessment/models/assessment.model';
import { CalendarModule } from '../calendar/calendar.module';
import { CalendarOccurrence } from '../calendar/models/calendar-occurrence.model';
import { SchemeResourceTemplate } from '../evaluation-scheme/models/scheme-resource-template.model';
import { SchemeSessionTemplate } from '../evaluation-scheme/models/scheme-session-template.model';
import { Patient } from '../patient/models/patient.model';
import { TreatmentCycle } from '../treatment-cycle/models/treatment-cycle.model';
import { User } from '../user/models/user.model';
import { ClinicalSessionResolver } from './resolvers/clinical-session.resolver';
import { ClinicalSessionCancellationReasonResolver } from './resolvers/clinical-session-cancellation-reason.resolver';
import { ClinicalSessionCancellationReason } from './models/clinical-session-cancellation-reason.model';
import { ClinicalSessionFollowUpSetting } from './models/clinical-session-follow-up-setting.model';
import { ClinicalSessionFollowUpVersion } from './models/clinical-session-follow-up-version.model';
import { ClinicalSessionSchemeApplication } from './models/clinical-session-scheme-application.model';
import { ClinicalSessionResource } from './models/clinical-session-resource.model';
import { ClinicalSession } from './models/clinical-session.model';
import { ClinicalSessionCancellationReasonService } from './services/clinical-session-cancellation-reason.service';
import { ClinicalSessionSchedulingService } from './services/clinical-session-scheduling.service';
import { ClinicalSessionTimingService } from './services/clinical-session-timing.service';

const guards = [GqlAuthGuard, PermissionGuard];

@Module({
    imports: [
        AssessmentModule,
        CalendarModule,
        NestjsQueryGraphQLModule.forFeature({
            imports: [
                NestjsQueryTypeOrmModule.forFeature([
                    ClinicalSession,
                    ClinicalSessionCancellationReason,
                    ClinicalSessionFollowUpSetting,
                    ClinicalSessionFollowUpVersion,
                    ClinicalSessionSchemeApplication,
                    ClinicalSessionResource,
                    CalendarOccurrence,
                    Assessment,
                    SchemeSessionTemplate,
                    SchemeResourceTemplate,
                    Patient,
                    TreatmentCycle,
                    User,
                ]),
            ],
            resolvers: [
                {
                    DTOClass: ClinicalSession,
                    EntityClass: ClinicalSession,
                    guards,
                    read: { disabled: true },
                    create: { disabled: true },
                    update: { disabled: true },
                    delete: { disabled: true },
                },
                {
                    DTOClass: ClinicalSessionResource,
                    EntityClass: ClinicalSessionResource,
                    guards,
                    read: { disabled: true },
                    create: { disabled: true },
                    update: { disabled: true },
                    delete: { disabled: true },
                },
            ],
        }),
    ],
    providers: [
        ClinicalSessionTimingService,
        ClinicalSessionCancellationReasonService,
        ClinicalSessionSchedulingService,
        ClinicalSessionResolver,
        ClinicalSessionCancellationReasonResolver,
    ],
    exports: [
        ClinicalSessionTimingService,
        ClinicalSessionCancellationReasonService,
        ClinicalSessionSchedulingService,
    ],
})
export class ClinicalSessionModule {}
