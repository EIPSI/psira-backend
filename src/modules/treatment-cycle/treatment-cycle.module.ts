import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Assessment } from '../assessment/models/assessment.model';
import { CalendarOccurrence } from '../calendar/models/calendar-occurrence.model';
import { ClinicalSessionResource } from '../clinical-session/models/clinical-session-resource.model';
import { ClinicalSession } from '../clinical-session/models/clinical-session.model';
import { Department } from '../department/models/department.model';
import { Patient } from '../patient/models/patient.model';
import { SettingModule } from '../setting/setting.module';
import { User } from '../user/models/user.model';
import { CaseHistoryEntry } from './models/case-history-entry.model';
import { CaseEventReason } from './models/case-event-reason.model';
import { CaseEventReasonTree } from './models/case-event-reason-tree.model';
import { TreatmentCycle } from './models/treatment-cycle.model';
import { CaseEventReasonResolver } from './resolvers/case-event-reason.resolver';
import { TreatmentCycleResolver } from './resolvers/treatment-cycle.resolver';
import { CaseEventReasonService } from './services/case-event-reason.service';
import { TreatmentCycleService } from './services/treatment-cycle.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            TreatmentCycle,
            CaseEventReason,
            CaseEventReasonTree,
            CaseHistoryEntry,
            ClinicalSession,
            ClinicalSessionResource,
            CalendarOccurrence,
            Assessment,
            Patient,
            User,
            Department,
        ]),
        SettingModule,
    ],
    providers: [
        TreatmentCycleService,
        CaseEventReasonService,
        TreatmentCycleResolver,
        CaseEventReasonResolver,
    ],
    exports: [
        TreatmentCycleService,
        CaseEventReasonService,
    ],
})
export class TreatmentCycleModule {}
