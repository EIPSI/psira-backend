import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from '../department/models/department.model';
import { Assessment } from '../assessment/models/assessment.model';
import { MailTemplate } from '../mail/models/mail-template.model';
import { Patient } from '../patient/models/patient.model';
import { Role } from '../permission/models/role.model';
import { User } from '../user/models/user.model';
import { SettingModule } from '../setting/setting.module';
import { NotificationLog } from './models/notification-log.model';
import { NotificationConfiguration } from './models/notification-configuration.model';
import { NotificationPreference } from './models/notification-preference.model';
import { NotificationConfigurationResolver } from './resolvers/notification-configuration.resolver';
import { NotificationConfigurationService } from './services/notification-configuration.service';
import { NotificationDispatchService } from './services/notification-dispatch.service';
import { NotificationPeriodicService } from './services/notification-periodic.service';
import { NotificationPreferenceService } from './services/notification-preference.service';

@Module({
    imports: [
        SettingModule,
        TypeOrmModule.forFeature([
            NotificationConfiguration,
            NotificationPreference,
            NotificationLog,
            Assessment,
            Department,
            Role,
            MailTemplate,
            User,
            Patient,
        ]),
    ],
    providers: [
        NotificationConfigurationResolver,
        NotificationConfigurationService,
        NotificationPreferenceService,
        NotificationDispatchService,
        NotificationPeriodicService,
    ],
    exports: [
        TypeOrmModule,
        NotificationConfigurationService,
        NotificationPreferenceService,
        NotificationDispatchService,
    ],
})
export class NotificationModule {}
