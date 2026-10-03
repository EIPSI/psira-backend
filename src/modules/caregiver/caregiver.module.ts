import { NestjsQueryGraphQLModule } from '@nestjs-query/query-graphql';
import { NestjsQueryTypeOrmModule } from '@nestjs-query/query-typeorm';
import { Module } from '@nestjs/common';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import { PermissionGuard } from 'src/modules/permission/guards/permission.guard';
import { Caregiver } from './models/caregiver.model';
import { CaregiverService } from './services/caregiver.service';
import { SortDirection } from '@nestjs-query/core';
import { UseOrPermissions } from 'src/modules/permission/decorators/permission.decorator';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { PatientCaregiver } from './models/patient-caregiver.model';
import { CaregiverResolver } from './resolvers/caregiver.resolver';
import { CaregiverInput } from './dtos/caregiver.input';
import { PatientCaregiverResolver } from './resolvers/patient-caregiver.resolver';
import { PatientCaregiverService } from './services/patient.caregiver.service';
import { PatientCaregiverInput } from './dtos/patient.caregiver.input';
import { UserModule } from '../user/user.module';
import { Patient } from '../patient/models/patient.model';
import { EmergencyContact } from '../patient/models/emergency-contact.model';

const guards = [GqlAuthGuard, PermissionGuard];
@Module({
    imports: [
        UserModule,
        NestjsQueryGraphQLModule.forFeature({
            imports: [NestjsQueryTypeOrmModule.forFeature([
                Caregiver,
                PatientCaregiver,
                Patient,
                EmergencyContact
            ])],
            resolvers: [
                {
                    DTOClass: Caregiver,
                    EntityClass: Caregiver,
                    CreateDTOClass: CaregiverInput,
                    guards: guards,
                    read: { disabled: true },
                    create: { disabled: true },
                    update: { decorators: [UseOrPermissions([PermissionEnum.CAREGIVERS_EDIT_DEPARTMENT, PermissionEnum.CAREGIVERS_EDIT_ASSIGNED])] },
                    delete: { disabled: true },
                },
                {
                    DTOClass: PatientCaregiver,
                    EntityClass: PatientCaregiver,
                    CreateDTOClass: PatientCaregiverInput,
                    guards: guards,
                    read: { disabled: true },
                    create: { disabled: true },
                    update: { decorators: [UseOrPermissions([PermissionEnum.CAREGIVERS_EDIT_DEPARTMENT, PermissionEnum.CAREGIVERS_EDIT_ASSIGNED])] },
                    delete: { decorators: [UseOrPermissions([PermissionEnum.CAREGIVERS_DELETE_DEPARTMENT, PermissionEnum.CAREGIVERS_DELETE_ASSIGNED])] },
                },
            ],
        }),
    ],
    providers: [
        CaregiverService,
        CaregiverResolver,
        PatientCaregiverResolver,
        PatientCaregiverService,
    ],
    exports: [
        CaregiverService
    ],
})

export class CaregiverModule { }
