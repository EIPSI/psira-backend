import { TypeOrmQueryService } from "@nestjs-query/query-typeorm";
import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CaregiverInput } from "../dtos/caregiver.input";
import { Caregiver } from "../models/caregiver.model";
import { RoleCode } from "src/modules/permission/enums/role-code.enum";
import { UserAccountProvisioningService } from "src/modules/user/services/user-account-provisioning.service";
@Injectable()
export class CaregiverService extends TypeOrmQueryService<Caregiver> {

    constructor(
        @InjectRepository(Caregiver) repo: Repository<Caregiver>,
        private readonly userAccountProvisioningService: UserAccountProvisioningService,
    ) {
        super(repo, { useSoftDelete: true });
    }

    async insert(caregiver: CaregiverInput) {
        if (!caregiver.email) {
            throw new BadRequestException('Caregiver email is required to create the linked user account.');
        }

        const isExisting = await this.repo.findOne({ where: { phone: caregiver.phone } });
        if (isExisting) throw new ConflictException();

        let newCaregiver = this.repo.create();
        newCaregiver = this.repo.merge(newCaregiver, caregiver);
        newCaregiver = await this.repo.save(newCaregiver);

        await this.createCaregiverUser(newCaregiver, caregiver);

        return newCaregiver;
    }

    private async createCaregiverUser(caregiver: Caregiver, input: CaregiverInput): Promise<void> {
        try {
            const account = await this.userAccountProvisioningService.createPersonUser({
                email: input.email,
                phone: input.phone,
                firstName: input.firstName,
                middleName: input.middleName,
                lastName: input.lastName,
                roleCode: RoleCode.CAREGIVER,
                fallbackUsername: `caregiver-${caregiver.id}`,
            });

            if (!account) {
                return;
            }

            await this.repo.update(caregiver.id, { userId: account.user.id });
            caregiver.userId = account.user.id;
        } catch (error) {
            throw new BadRequestException('Failed to create user for caregiver.');
        }
    }
}
