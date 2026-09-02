import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from '../department/models/department.model';
import { Patient } from '../patient/models/patient.model';
import { Role } from '../permission/models/role.model';
import { User } from '../user/models/user.model';
import { NotificationModule } from '../notification/notification.module';
import { SettingModule } from '../setting/setting.module';
import { InformedConsentAnswerOption } from './models/informed-consent-answer-option.model';
import { InformedConsentManagement } from './models/informed-consent-management.model';
import { InformedConsentModel } from './models/informed-consent-model.model';
import { InformedConsentQuestion } from './models/informed-consent-question.model';
import { InformedConsentResponseAnswer } from './models/informed-consent-response-answer.model';
import { InformedConsentResponse } from './models/informed-consent-response.model';
import { InformedConsentReview } from './models/informed-consent-review.model';
import { InformedConsentTextBlock } from './models/informed-consent-text-block.model';
import { InformedConsentVersion } from './models/informed-consent-version.model';
import { InformedConsentManagementResolver } from './resolvers/informed-consent-management.resolver';
import { InformedConsentModelResolver } from './resolvers/informed-consent-model.resolver';
import { InformedConsentPublicResolver } from './resolvers/informed-consent-public.resolver';
import { InformedConsentResponseResolver } from './resolvers/informed-consent-response.resolver';
import { InformedConsentAccessService } from './services/informed-consent-access.service';
import { InformedConsentManagementService } from './services/informed-consent-management.service';
import { InformedConsentModelService } from './services/informed-consent-model.service';
import { InformedConsentResponseService } from './services/informed-consent-response.service';

@Global()
@Module({
    imports: [
        NotificationModule,
        SettingModule,
        TypeOrmModule.forFeature([
            InformedConsentModel,
            InformedConsentVersion,
            InformedConsentTextBlock,
            InformedConsentQuestion,
            InformedConsentAnswerOption,
            InformedConsentManagement,
            InformedConsentResponse,
            InformedConsentResponseAnswer,
            InformedConsentReview,
            Department,
            Role,
            User,
            Patient,
        ]),
    ],
    providers: [
        InformedConsentModelService,
        InformedConsentManagementService,
        InformedConsentResponseService,
        InformedConsentAccessService,
        InformedConsentModelResolver,
        InformedConsentManagementResolver,
        InformedConsentResponseResolver,
        InformedConsentPublicResolver,
    ],
    exports: [
        TypeOrmModule,
        InformedConsentModelService,
        InformedConsentManagementService,
        InformedConsentResponseService,
        InformedConsentAccessService,
    ],
})
export class InformedConsentModule {}
