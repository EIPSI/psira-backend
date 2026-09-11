import { NestjsQueryGraphQLModule } from '@nestjs-query/query-graphql';
import { NestjsQueryTypeOrmModule } from '@nestjs-query/query-typeorm';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GqlAuthGuard } from '../auth/auth.guard';
import { Department } from '../department/models/department.model';
import { EvaluationScheme } from '../evaluation-scheme/models/evaluation-scheme.model';
import { PermissionGuard } from '../permission/guards/permission.guard';
import { UserModule } from '../user/user.module';
import {
    QuestionnaireBundle,
    QuestionnaireBundleSchema,
} from '../questionnaire/models/questionnaire-bundle.schema';
import {
    Questionnaire,
    QuestionnaireSchema,
} from '../questionnaire/models/questionnaire.schema';
import { QuestionnaireBundleResolutionService } from '../questionnaire/services/questionnaire-bundle-resolution.service';
import { RandomizationRule } from './models/randomization-rule.model';
import { RandomizationRuleItem } from './models/randomization-rule-item.model';
import { RandomizationRuleResolver } from './resolvers/randomization-rule.resolver';
import { RandomizationResolutionService } from './services/randomization-resolution.service';
import { RandomizationRuleService } from './services/randomization-rule.service';

const guards = [GqlAuthGuard, PermissionGuard];

@Module({
    imports: [
        NestjsQueryGraphQLModule.forFeature({
            imports: [
                NestjsQueryTypeOrmModule.forFeature([
                    RandomizationRule,
                    RandomizationRuleItem,
                    Department,
                    EvaluationScheme,
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
                    DTOClass: RandomizationRule,
                    EntityClass: RandomizationRule,
                    guards,
                    read: { disabled: true },
                    create: { disabled: true },
                    update: { disabled: true },
                    delete: { disabled: true },
                },
                {
                    DTOClass: RandomizationRuleItem,
                    EntityClass: RandomizationRuleItem,
                    guards,
                    read: { disabled: false },
                    create: { disabled: true },
                    update: { disabled: true },
                    delete: { disabled: true },
                },
            ],
        }),
        UserModule,
    ],
    providers: [
        QuestionnaireBundleResolutionService,
        RandomizationRuleService,
        RandomizationResolutionService,
        RandomizationRuleResolver,
    ],
    exports: [RandomizationRuleService, RandomizationResolutionService],
})
export class RandomizationModule {}
