import { SortDirection } from '@nestjs-query/core';
import { NestjsQueryGraphQLModule } from '@nestjs-query/query-graphql';
import { NestjsQueryTypeOrmModule } from '@nestjs-query/query-typeorm';
import { Module } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/auth.guard';
import {
    UseOrPermissions,
    UsePermission,
} from '../permission/decorators/permission.decorator';
import { PermissionEnum } from '../permission/enums/permission.enum';
import { PermissionGuard } from '../permission/guards/permission.guard';
import { CreatePatientInput } from './dto/create-patient.input';
import { EmergencyContactInput } from './dto/emergency-contact.input';
import { UpdatePatientInput } from './dto/update-patient.input';
import { EmergencyContact } from './models/emergency-contact.model';
import { Informant } from './models/informant.model';
import { PatientStatus } from './models/patient-status.model';
import { Patient } from './models/patient.model';
import { CaseManagerService } from './providers/case-manager.service';
import { CaseManagerResolver } from './resolvers/case-manager.resolver';
import { EmergencyContactResolver } from './resolvers/emergency-contact.resolver';
import { PatientResolver } from './resolvers/patient.resolver';
import { PatientQueryService } from './providers/patient-query.service';
import { QuestionnaireAssessmentService } from '../questionnaire/services/questionnaire-assessment.service';
import {
    AssessmentSchema,
    QuestionnaireAssessment,
} from '../questionnaire/models/questionnaire-assessment.schema';
import { MongooseModule } from '@nestjs/mongoose';
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
import { QuestionnaireModule } from '../questionnaire/questionnaire.module';
import { MailModule } from '../mail/mail.module';
import { PatientStatusService } from './providers/patient-status.service';
import { Assessment } from '../assessment/models/assessment.model';
import { PermissionModule } from '../permission/permission.module';
import { PatientPermissionService } from './services/patient-permission.service';
import { UserModule } from '../user/user.module';
import { SettingModule } from '../setting/setting.module';

const guards = [GqlAuthGuard, PermissionGuard];
@Module({
    imports: [
        UserModule,
        PermissionModule,
        SettingModule,
        QuestionnaireModule,
        MailModule,
        NestjsQueryGraphQLModule.forFeature({
            // import the NestjsQueryTypeOrmModule to register the entity with typeorm
            // and provide a QueryService
            imports: [
                NestjsQueryTypeOrmModule.forFeature([
                    Assessment,
                    Patient,
                    Informant,
                    EmergencyContact,
                    PatientStatus,
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

            // describe the resolvers you want to expose
            resolvers: [
                {
                    DTOClass: Patient,
                    EntityClass: Patient,
                    CreateDTOClass: CreatePatientInput,
                    UpdateDTOClass: UpdatePatientInput,
                    guards: guards,
                    read: { disabled: true },
                    create: { disabled: true },
                    update: { disabled: true },
                    delete: { disabled: true },
                },
                {
                    DTOClass: Informant,
                    EntityClass: Informant,
                    guards: guards,
                    read: {
                        defaultSort: [
                            { field: 'id', direction: SortDirection.DESC },
                        ],
                        decorators: [
                            UseOrPermissions([
                                PermissionEnum.PATIENTS_VIEW_ALL,
                                PermissionEnum.PATIENTS_VIEW_DEPARTMENT,
                                PermissionEnum.PATIENTS_VIEW_ASSIGNED,
                            ]),
                        ],
                    },
                    create: {
                        decorators: [
                            UseOrPermissions([
                                PermissionEnum.PATIENTS_CREATE_ALL,
                                PermissionEnum.PATIENTS_CREATE_DEPARTMENT,
                                PermissionEnum.PATIENTS_CREATE_ASSIGNED,
                            ]),
                        ],
                    },
                    update: {
                        decorators: [
                            UseOrPermissions([
                                PermissionEnum.PATIENTS_EDIT_ALL,
                                PermissionEnum.PATIENTS_EDIT_DEPARTMENT,
                                PermissionEnum.PATIENTS_EDIT_ASSIGNED,
                            ]),
                        ],
                    },
                    delete: {
                        decorators: [
                            UseOrPermissions([
                                PermissionEnum.PATIENTS_DELETE_ALL,
                                PermissionEnum.PATIENTS_DELETE_DEPARTMENT,
                                PermissionEnum.PATIENTS_DELETE_ASSIGNED,
                            ]),
                        ],
                    },
                },
                {
                    DTOClass: EmergencyContact,
                    EntityClass: EmergencyContact,
                    CreateDTOClass: EmergencyContactInput,
                    UpdateDTOClass: EmergencyContactInput,
                    guards: guards,
                    read: {
                        defaultSort: [
                            { field: 'id', direction: SortDirection.DESC },
                        ],
                        decorators: [
                            UseOrPermissions([
                                PermissionEnum.PATIENTS_VIEW_ALL,
                                PermissionEnum.PATIENTS_VIEW_DEPARTMENT,
                                PermissionEnum.PATIENTS_VIEW_ASSIGNED,
                            ]),
                        ],
                    },
                    create: { disabled: true },
                    update: {
                        decorators: [
                            UseOrPermissions([
                                PermissionEnum.PATIENTS_EDIT_ALL,
                                PermissionEnum.PATIENTS_EDIT_DEPARTMENT,
                                PermissionEnum.PATIENTS_EDIT_ASSIGNED,
                            ]),
                        ],
                    },
                    delete: {
                        decorators: [
                            UseOrPermissions([
                                PermissionEnum.PATIENTS_EDIT_ALL,
                                PermissionEnum.PATIENTS_EDIT_DEPARTMENT,
                                PermissionEnum.PATIENTS_EDIT_ASSIGNED,
                            ]),
                        ],
                    },
                },
                {
                    DTOClass: PatientStatus,
                    EntityClass: PatientStatus,
                    guards: guards,
                    read: {
                        defaultSort: [
                            { field: 'id', direction: SortDirection.DESC },
                        ],
                    },
                    create: {
                        disabled: true,
                    },
                    update: {
                        decorators: [
                            UsePermission(PermissionEnum.SETTINGS_EDIT_ALL),
                        ],
                    },
                    delete: {
                        decorators: [
                            UsePermission(PermissionEnum.SETTINGS_EDIT_ALL),
                        ],
                    },
                },
            ],
        }),
    ],
    providers: [
        CaseManagerService,
        CaseManagerResolver,
        PatientResolver,
        EmergencyContactResolver,
        PatientQueryService,
        QuestionnaireAssessmentService,
        QuestionnaireBundleResolutionService,
        PatientStatusService,
        PatientPermissionService,
    ],
    exports: [PatientQueryService, PatientPermissionService],
})
export class PatientModule {}
