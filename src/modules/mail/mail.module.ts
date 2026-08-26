import { NestjsQueryGraphQLModule } from '@nestjs-query/query-graphql';
import { NestjsQueryTypeOrmModule } from '@nestjs-query/query-typeorm';
import { Module } from '@nestjs/common';
import { Assessment } from '../assessment/models/assessment.model';
import { GqlAuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/guards/permission.guard';
import { QuestionnaireAssessmentService } from '../questionnaire/services/questionnaire-assessment.service';
import { MailTemplate } from './models/mail-template.model';
import { MailResolver } from './resolvers/mail.resolver';
import { MailTemplateService } from './services/mail-template.service';
import { SendMailService } from './services/send-mail.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AssessmentSchema,
  QuestionnaireAssessment,
} from '../questionnaire/models/questionnaire-assessment.schema';
import { Answer, AnswerSchema } from '../questionnaire/models/answer.schema';
import {
  Questionnaire,
  QuestionnaireSchema,
} from '../questionnaire/models/questionnaire.schema';
import {
  QuestionnaireBundle,
  QuestionnaireBundleSchema,
} from '../questionnaire/models/questionnaire-bundle.schema';
import { QuestionnaireBundleResolutionService } from '../questionnaire/services/questionnaire-bundle-resolution.service';
import { SettingModule } from '../setting/setting.module';
import { User } from '../user/models/user.model';
import { PermissionModule } from '../permission/permission.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    SettingModule,
    PermissionModule,
    NotificationModule,
    NestjsQueryGraphQLModule.forFeature({
      imports: [
        NestjsQueryTypeOrmModule.forFeature([
          MailTemplate,
          Assessment,
          User,
        ]),
        MongooseModule.forFeature([
          {
              name: QuestionnaireAssessment.name,
              schema: AssessmentSchema,
          },
          { name: Answer.name, schema: AnswerSchema },
          {
              name: Questionnaire.name,
              schema: QuestionnaireSchema,
          },
          {
              name: QuestionnaireBundle.name,
              schema: QuestionnaireBundleSchema,
          },
        ]),
      ],
      resolvers: [
        {
          DTOClass: MailTemplate,
          EntityClass: MailTemplate,
          guards: [GqlAuthGuard, PermissionGuard],
          read: { disabled: true },
          create: { disabled: true },
          update: { disabled: true },
          delete: { disabled: true },
        }
      ],
    }),
  ],
  providers: [
    MailResolver,
    MailTemplateService,
    SendMailService,
    QuestionnaireAssessmentService,
    QuestionnaireBundleResolutionService,
  ],
  exports: [SendMailService]
})
export class MailModule {}
