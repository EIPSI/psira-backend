import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { RoleCode } from 'src/modules/permission/enums/role-code.enum';
import { User } from '../models/user.model';
import { UserCrudService } from '../providers/user-crud.service';

export interface ProvisionPersonUserInput {
    email?: string;
    phone?: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    roleCode: RoleCode;
    departmentIds?: number[];
    fallbackUsername?: string;
    skippedAutomationIds?: number[];
}

export interface ProvisionedUserAccount {
    user: User;
    tempPassword: string;
}

@Injectable()
export class UserAccountProvisioningService {
    constructor(
        @Inject(forwardRef(() => UserCrudService))
        private readonly userCrudService: UserCrudService,
    ) {}

    async createPersonUser(input: ProvisionPersonUserInput): Promise<ProvisionedUserAccount | null> {
        const username = this.buildUsername(input);

        if (!username) {
            return null;
        }

        const tempPassword = this.generateRandomPassword();

        const user = await this.userCrudService.createOne({
            username,
            email: input.email,
            phone: input.phone,
            firstName: input.firstName,
            middleName: input.middleName,
            lastName: input.lastName,
            password: tempPassword,
            active: true,
            departmentIds: input.departmentIds,
            roleCodes: [input.roleCode],
            skippedAutomationIds: input.skippedAutomationIds,
            skipCaregiverProfileSync: input.roleCode === RoleCode.CAREGIVER,
        });

        return { user, tempPassword };
    }

    private buildUsername(input: ProvisionPersonUserInput): string | null {
        return input.email ? input.email.trim().toLowerCase() : null;
    }

    private generateRandomPassword(): string {
        const length = 12;
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        let password = '';

        for (let i = 0; i < length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }

        return password;
    }
}
