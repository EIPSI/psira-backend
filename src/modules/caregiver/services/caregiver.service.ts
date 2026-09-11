import { TypeOrmQueryService } from "@nestjs-query/query-typeorm";
import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CaregiverInput } from "../dtos/caregiver.input";
import { Caregiver } from "../models/caregiver.model";
import { PatientCaregiver } from "../models/patient-caregiver.model";
import { Patient } from "src/modules/patient/models/patient.model";
import { EmergencyContact } from "src/modules/patient/models/emergency-contact.model";
import { RoleCode } from "src/modules/permission/enums/role-code.enum";
import { UserAccountProvisioningService } from "src/modules/user/services/user-account-provisioning.service";
@Injectable()
export class CaregiverService extends TypeOrmQueryService<Caregiver> {

    constructor(
        @InjectRepository(Caregiver) repo: Repository<Caregiver>,
        @InjectRepository(Patient)
        private readonly patientRepository: Repository<Patient>,
        @InjectRepository(PatientCaregiver)
        private readonly patientCaregiverRepository: Repository<PatientCaregiver>,
        @InjectRepository(EmergencyContact)
        private readonly emergencyContactRepository: Repository<EmergencyContact>,
        private readonly userAccountProvisioningService: UserAccountProvisioningService,
    ) {
        super(repo, { useSoftDelete: true });
    }

    async insert(caregiver: CaregiverInput) {
        if (!caregiver.patientId) {
            throw new BadRequestException('Caregiver must be linked to a patient.');
        }
        if (!caregiver.email) {
            throw new BadRequestException('Caregiver email is required to create the linked user account.');
        }

        const patient = await this.patientRepository.findOne({
            where: { id: caregiver.patientId },
            relations: ['departments'],
        });
        if (!patient) {
            throw new BadRequestException('Linked patient was not found.');
        }

        const isExisting = await this.repo.findOne({ where: { phone: caregiver.phone } });
        if (isExisting) throw new ConflictException();

        let newCaregiver = this.repo.create();
        const { patientId, relation, emergency, note, skipEmergencyContactCreation, emergencyContactId, ...caregiverData } = caregiver as any;
        newCaregiver = this.repo.merge(newCaregiver, caregiverData);
        newCaregiver = await this.repo.save(newCaregiver);

        await this.createCaregiverUser(
            newCaregiver,
            caregiver,
            patient.departments?.map(department => department.id) ?? [],
        );
        await this.patientCaregiverRepository.save(this.patientCaregiverRepository.create({
            patientId: caregiver.patientId,
            caregiverId: newCaregiver.id,
            relation,
            emergency: !!emergency,
            note,
        }));

        if (emergency && emergencyContactId) {
            await this.emergencyContactRepository.update(
                { id: emergencyContactId, patientId: caregiver.patientId },
                { caregiverId: newCaregiver.id },
            );
        } else if (emergency && !skipEmergencyContactCreation) {
            const existingEmergencyContact = await this.findMatchingEmergencyContact(caregiver);
            if (existingEmergencyContact) {
                await this.emergencyContactRepository.update(existingEmergencyContact.id, { caregiverId: newCaregiver.id });
            } else {
                await this.emergencyContactRepository.save(this.emergencyContactRepository.create({
                    patientId: caregiver.patientId,
                    firstName: caregiver.firstName,
                    middleName: caregiver.middleName,
                    lastName: caregiver.lastName,
                    phone: caregiver.phone,
                    email: caregiver.email,
                    caregiverId: newCaregiver.id,
                }));
            }
        }

        return newCaregiver;
    }

    private async findMatchingEmergencyContact(caregiver: CaregiverInput): Promise<EmergencyContact | undefined> {
        const patientId = caregiver.patientId;
        if (caregiver.email) {
            const byEmail = await this.emergencyContactRepository.findOne({ where: { patientId, email: caregiver.email } });
            if (byEmail) return byEmail;
        }
        if (caregiver.phone) {
            const byPhone = await this.emergencyContactRepository.findOne({ where: { patientId, phone: caregiver.phone } });
            if (byPhone) return byPhone;
        }
        return this.emergencyContactRepository.findOne({
            where: {
                patientId,
                firstName: caregiver.firstName,
                lastName: caregiver.lastName,
            },
        });
    }

    private async createCaregiverUser(caregiver: Caregiver, input: CaregiverInput, departmentIds: number[]): Promise<void> {
        try {
            const account = await this.userAccountProvisioningService.createPersonUser({
                email: input.email,
                phone: input.phone,
                firstName: input.firstName,
                middleName: input.middleName,
                lastName: input.lastName,
                roleCode: RoleCode.CAREGIVER,
                departmentIds,
                fallbackUsername: `caregiver-${caregiver.id}`,
                skippedAutomationIds: input.skippedAutomationIds,
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
