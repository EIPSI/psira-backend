import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssessmentModule } from '../assessment/assessment.module';
import { AssessmentType } from '../assessment/models/assessment-type.model';
import { Department } from '../department/models/department.model';
import { EvaluationSchemeModule } from '../evaluation-scheme/evaluation-scheme.module';
import { EvaluationScheme } from '../evaluation-scheme/models/evaluation-scheme.model';
import { MailTemplate } from '../mail/models/mail-template.model';
import { Patient } from '../patient/models/patient.model';
import { Role } from '../permission/models/role.model';
import {
    QuestionnaireBundle,
    QuestionnaireBundleSchema,
} from '../questionnaire/models/questionnaire-bundle.schema';
import {
    Questionnaire,
    QuestionnaireSchema,
} from '../questionnaire/models/questionnaire.schema';
import { RandomizationRule } from '../randomization/models/randomization-rule.model';
import { SettingModule } from '../setting/setting.module';
import { User } from '../user/models/user.model';
import { EvaluationAutomationRun } from './models/evaluation-automation-run.model';
import { EvaluationAutomation } from './models/evaluation-automation.model';
import { EvaluationAutomationResolver } from './resolvers/evaluation-automation.resolver';
import { EvaluationAutomationEngineService } from './services/evaluation-automation-engine.service';
import { EvaluationAutomationManagementService } from './services/evaluation-automation-management.service';
import { EvaluationAutomationRetentionService } from './services/evaluation-automation-retention.service';

@Global()
@Module({
    imports: [
        AssessmentModule,
        EvaluationSchemeModule,
        SettingModule,
        TypeOrmModule.forFeature([
            EvaluationAutomation,
            EvaluationAutomationRun,
            Department,
            Role,
            EvaluationScheme,
            AssessmentType,
            MailTemplate,
            User,
            Patient,
            RandomizationRule,
        ]),
        MongooseModule.forFeature([
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
    providers: [
        EvaluationAutomationEngineService,
        {
            provide: 'EVALUATION_AUTOMATION_ENGINE',
            useExisting: EvaluationAutomationEngineService,
        },
        EvaluationAutomationManagementService,
        EvaluationAutomationRetentionService,
        EvaluationAutomationResolver,
    ],
    exports: [
        TypeOrmModule,
        EvaluationAutomationEngineService,
        'EVALUATION_AUTOMATION_ENGINE',
    ],
})
export class EvaluationAutomationModule {}
