import { Injectable, Module } from '@nestjs/common';
import { Authorizer, NestjsQueryGraphQLModule } from '@nestjs-query/query-graphql';
import { NestjsQueryTypeOrmModule } from '@nestjs-query/query-typeorm';
import { User } from './models/user.model';
import { UserCrudService } from './providers/user-crud.service';
import { UserCrudResolver } from './resolvers/user-crud.resolver';
import { SettingModule } from '../setting/setting.module';
import { ChangePasswordService } from './providers/change-password.service';
import { ChangePasswordResolver } from './resolvers/change-password.resolver';
import { UserDepartmentAccessService } from './services/user-department-access.service';
import { PermissionModule } from '../permission/permission.module';
import { Role } from '../permission/models/role.model';
import { UserAccountProvisioningService } from './services/user-account-provisioning.service';
import { TherapistSupervisionService } from './services/therapist-supervision.service';
import { TherapistSupervisionResolver } from './resolvers/therapist-supervision.resolver';
import { MailModule } from '../mail/mail.module';
import { Patient } from '../patient/models/patient.model';
import { Caregiver } from '../caregiver/models/caregiver.model';
import { UserPreviousPasswordRetentionService } from './services/user-previous-password-retention.service';

@Injectable()
export class UserAuthorizer implements Authorizer<User> {
    async authorize() {
        return {};
    }

    async authorizeRelation() {
        return {};
    }
}

@Module({
    imports: [
        SettingModule,
        PermissionModule,
        MailModule,
        NestjsQueryGraphQLModule.forFeature({
            // import the NestjsQueryTypeOrmModule to register the entity with typeorm
            // and provide a QueryService
            imports: [NestjsQueryTypeOrmModule.forFeature([User, Role, Patient, Caregiver])],
            // describe the resolvers you want to expose
            resolvers: [],
        }),
    ],
    providers: [
        UserCrudService,
        UserCrudResolver,
        ChangePasswordService,
        ChangePasswordResolver,
        UserAuthorizer,
        UserDepartmentAccessService,
        UserAccountProvisioningService,
        UserPreviousPasswordRetentionService,
        TherapistSupervisionService,
        TherapistSupervisionResolver,
    ],
    exports: [UserCrudService, UserAccountProvisioningService, UserDepartmentAccessService],
})
export class UserModule { }
