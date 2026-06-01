import { NestjsQueryGraphQLModule } from '@nestjs-query/query-graphql';
import { NestjsQueryTypeOrmModule } from '@nestjs-query/query-typeorm';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AssessmentType } from '../assessment/models/assessment-type.model';
import { AssessmentModule } from '../assessment/assessment.module';
import { Assessment } from '../assessment/models/assessment.model';
import { GqlAuthGuard } from '../auth/auth.guard';
import { CalendarOccurrence } from '../calendar/models/calendar-occurrence.model';
import { ClinicalSessionModule } from '../clinical-session/clinical-session.module';
import { ClinicalSessionResource } from '../clinical-session/models/clinical-session-resource.model';
import { ClinicalSession } from '../clinical-session/models/clinical-session.model';
import { Patient } from '../patient/models/patient.model';
import { PermissionGuard } from '../permission/guards/permission.guard';
import { User } from '../user/models/user.model';
import { EvaluationSchemeGenerationResolver } from './resolvers/evaluation-scheme-generation.resolver';
import { EvaluationSchemeManagementResolver } from './resolvers/evaluation-scheme-management.resolver';
import { IndependentEvaluationTemplate } from './models/independent-evaluation-template.model';
import { EvaluationSchemeAssignment } from './models/evaluation-scheme-assignment.model';
import { EvaluationScheme } from './models/evaluation-scheme.model';
import { SchemeResourceTemplate } from './models/scheme-resource-template.model';
import { SchemeSessionTemplate } from './models/scheme-session-template.model';
import { EvaluationSchemeManagementService } from './services/evaluation-scheme-management.service';
import { SchemeGenerationService } from './services/scheme-generation.service';
import { RandomizationModule } from '../randomization/randomization.module';
import { UserModule } from '../user/user.module';
import { RandomizationRule } from '../randomization/models/randomization-rule.model';
import {
    Questionnaire,
    QuestionnaireSchema,
} from '../questionnaire/models/questionnaire.schema';
import {
    QuestionnaireBundle,
    QuestionnaireBundleSchema,
} from '../questionnaire/models/questionnaire-bundle.schema';

const guards = [GqlAuthGuard, PermissionGuard];

@Module({
    imports: [
        AssessmentModule,
        ClinicalSessionModule,
        RandomizationModule,
        UserModule,
        NestjsQueryGraphQLModule.forFeature({
            imports: [
                NestjsQueryTypeOrmModule.forFeature([
                    EvaluationScheme,
                    EvaluationSchemeAssignment,
                    SchemeSessionTemplate,
                    SchemeResourceTemplate,
                    IndependentEvaluationTemplate,
                    AssessmentType,
                    CalendarOccurrence,
                    Assessment,
                    ClinicalSession,
                    ClinicalSessionResource,
                    Patient,
                    User,
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
            resolvers: [
                {
                    DTOClass: EvaluationScheme,
                    EntityClass: EvaluationScheme,
                    guards,
                    read: { disabled: true },
                    create: { disabled: true },
                    update: { disabled: true },
                    delete: { disabled: true },
                },
                {
                    DTOClass: EvaluationSchemeAssignment,
                    EntityClass: EvaluationSchemeAssignment,
                    guards,
                    read: { disabled: false },
                    create: { disabled: true },
                    update: { disabled: true },
                    delete: { disabled: true },
                },
                {
                    DTOClass: SchemeSessionTemplate,
                    EntityClass: SchemeSessionTemplate,
                    guards,
                    read: { disabled: false },
                    create: { disabled: true },
                    update: { disabled: true },
                    delete: { disabled: true },
                },
                {
                    DTOClass: SchemeResourceTemplate,
                    EntityClass: SchemeResourceTemplate,
                    guards,
                    read: { disabled: false },
                    create: { disabled: true },
                    update: { disabled: true },
                    delete: { disabled: true },
                },
                {
                    DTOClass: IndependentEvaluationTemplate,
                    EntityClass: IndependentEvaluationTemplate,
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
        SchemeGenerationService,
        EvaluationSchemeManagementService,
        EvaluationSchemeGenerationResolver,
        EvaluationSchemeManagementResolver,
    ],
    exports: [SchemeGenerationService],
})
export class EvaluationSchemeModule {}
