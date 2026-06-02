import { QueryService } from '@nestjs-query/core';
import { TypeOrmQueryService } from '@nestjs-query/query-typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { User } from '../models/user.model';
import * as moment from 'moment';
import { CreateUserInput } from '../dto/create-user.input';
import { BadRequestException, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Role } from 'src/modules/permission/models/role.model';
import { RoleCode } from 'src/modules/permission/enums/role-code.enum';
import { UpdateUserInput } from '../dto/update-user.input';
import { PermissionService } from 'src/modules/permission/providers/permission.service';
import {Hash} from "../../../shared";
import { Department } from 'src/modules/department/models/department.model';
import { SendMailService } from 'src/modules/mail/services/send-mail.service';
import { Patient } from 'src/modules/patient/models/patient.model';
import { Caregiver } from 'src/modules/caregiver/models/caregiver.model';

@QueryService(User)
export class UserCrudService extends TypeOrmQueryService<User> {
    private readonly logger = new Logger('UserCrudService');

    constructor(
        @InjectRepository(User) repo: Repository<User>,
        @InjectRepository(Patient)
        private readonly patientRepository: Repository<Patient>,
        @InjectRepository(Caregiver)
        private readonly caregiverRepository: Repository<Caregiver>,
        private readonly sendMailService: SendMailService,
        private readonly moduleRef: ModuleRef,
    ) {
        // pass the use soft delete option to the service.
        super(repo);
    }

    async createOne(input: CreateUserInput): Promise<User> {
        if (!input.email) {
            throw new BadRequestException('Email is required');
        }

        input.username = input.email.toLowerCase();

        // Check duplicate username exists
        const exists = await super.query({
            filter: { username: { iLike: input.username } }, // case in-sensitive match username
        });

        if (exists.length > 0) {
            throw new BadRequestException('Username already exists');
        }

        const { roleCodes, skippedAutomationIds, ...userInput } = input as any;
        const { departmentIds: inputDepartmentIds, ...rest } = userInput;
        let departmentIds = inputDepartmentIds;
        const plainPassword = rest.password;
        const user = await super.createOne(rest);

        user.passwordExpiresAt = moment().toDate();
        user.password = await Hash.make(user.password);
        user.skippedAutomationIds = skippedAutomationIds || [];

        if (roleCodes && roleCodes.length > 0) {
            const roles = await Role.find({ where: { code: In(roleCodes) } });
            user.roles = roles;
        }

        departmentIds = await this.applyDefaultDepartmentsForRoles(roleCodes, departmentIds);

        if (departmentIds && departmentIds.length > 0) {
            const departments = await Department.find({ where: { id: In(departmentIds) } });
            user.departments = departments;
        }

        await user.save();

        if (user.email) {
            await this.sendMailService.sendWelcomeEmail(user, plainPassword);
        }

        await this.syncPersonProfilesForRoles(user);
        await this.dispatchUserCreatedAutomation(user, skippedAutomationIds);

        return user;
    }

    async updateOneUser(
        id: number,
        update: UpdateUserInput,
        currentUser: User,
    ): Promise<User> {
        // Validate permission hierachy
        if (!(await PermissionService.compareHierarchy(currentUser.id, +id))) {
            throw new BadRequestException(
                'Permission denied to modify user! User has higher or equal role than current user',
            );
        }

        // Check for duplicate username
        if (update.email) {
            update.username = update.email.toLowerCase();
        }

        if (!!update.username) {
            const [exists] = await super.query({
                filter: {
                    and: [
                        { username: { iLike: update.username } }, // case in-sensitive match username
                        { id: { neq: Number(id) } }, // exclude current row from duplicate check
                    ],
                },
            });

            if (exists) {
                throw new BadRequestException('Username already exists');
            }
        }

        const { roleCodes, ...userInput } = update as any;
        const { departmentIds: inputDepartmentIds, ...rest } = userInput;
        let departmentIds = inputDepartmentIds;

        let roles: Role[] = [];
        if (roleCodes) {
            roles = await Role.find({ where: { code: In(roleCodes) } });
            await this.setRelations('roles', id, roles.map(r => r.id));
        }

        if (roleCodes?.includes(RoleCode.THERAPIST) && !departmentIds) {
            departmentIds = await Department.createQueryBuilder('department')
                .innerJoin('department.users', 'user', 'user.id = :id', { id })
                .getMany()
                .then(departments => departments.map(department => department.id));
        }
        departmentIds = await this.applyDefaultDepartmentsForRoles(roleCodes, departmentIds);

        let departments: Department[] = [];
        if (departmentIds) {
            departments = await Department.find({ where: { id: In(departmentIds) } });
            await this.setRelations('departments', id, departmentIds);
        }

        const user = await super.updateOne(id, rest);
        user.departments = departmentIds
            ? departments
            : await Department.createQueryBuilder('department')
                .innerJoin('department.users', 'user', 'user.id = :id', { id })
                .getMany();

        if (roleCodes) {
            user.roles = roles.length
                ? roles
                : await Role.find({ where: { code: In(roleCodes) } });
        } else {
            user.roles = await Role.createQueryBuilder('role')
                .innerJoin('role.users', 'user', 'user.id = :id', { id })
                .getMany();
        }

        await this.syncPersonProfilesForRoles(user);

        return user;
    }

    async updateUserAcceptedTerm(
        id: number,
        update: UpdateUserInput,
    ): Promise<User> {
        // Check for duplicate username
        update = { acceptedTerm: update.acceptedTerm };

        return super.updateOne(id, update);
    }

    async deleteOneUser(id: number, currentUser: User): Promise<boolean> {
        if (!(await PermissionService.compareHierarchy(currentUser.id, +id))) {
            throw new BadRequestException(
                'Permission denied to delete user! User has higher or equal role than current user',
            );
        }

        const user = await super.deleteOne(id)
        return !!user;
    }

    passwordChangeRequired(user: User): boolean {
        return user.passwordExpiresAt
            ? moment().isSameOrAfter(user.passwordExpiresAt)
            : true;
    }

    private async syncPersonProfilesForRoles(user: User): Promise<void> {
        const roleCodes = user.roles?.map(role => role.code) ?? [];

        if (roleCodes.includes(RoleCode.PATIENT)) {
            await this.ensurePatientForUser(user);
        }

        if (roleCodes.includes(RoleCode.CAREGIVER)) {
            await this.ensureCaregiverForUser(user);
        }
    }

    private async dispatchUserCreatedAutomation(
        user: User,
        excludedAutomationIds?: number[],
    ): Promise<void> {
        try {
            const automationEngine = this.moduleRef.get(
                'EVALUATION_AUTOMATION_ENGINE',
                { strict: false },
            ) as any;
            await automationEngine.handleTrigger({
                triggerPoint: 'user_created',
                userId: user.id,
                excludedAutomationIds,
            });
        } catch (error) {
            this.logger.error(
                `Unable to dispatch user_created automation for user ${user.id}: ${error?.message}`,
            );
        }
    }

    private async applyDefaultDepartmentsForRoles(roleCodes?: string[], departmentIds?: number[]): Promise<number[] | undefined> {
        if (!roleCodes?.includes(RoleCode.THERAPIST)) {
            return departmentIds;
        }

        let particular = await Department.findOne({ where: { name: 'Particular' } });
        if (!particular) {
            particular = Department.create({
                name: 'Particular',
                description: 'Default department for private therapists',
                active: true,
            });
            await particular.save();
        }

        return [...new Set([...(departmentIds ?? []), particular.id])];
    }

    private async ensurePatientForUser(user: User): Promise<void> {
        const existingPatient = await this.patientRepository.findOne({
            where: { userId: user.id },
        });

        if (existingPatient) {
            await this.updatePatientFromUser(existingPatient.id, user);
            await this.syncPatientDepartments(existingPatient.id, user);
            return;
        }

        const unlinkedPatient = user.email
            ? await this.patientRepository.findOne({
                where: { email: user.email, userId: IsNull() },
            })
            : null;

        if (unlinkedPatient) {
            await this.updatePatientFromUser(unlinkedPatient.id, user);
            await this.syncPatientDepartments(unlinkedPatient.id, user);
            return;
        }

        const patient = this.patientRepository.create({
            userId: user.id,
            firstName: user.firstName,
            middleName: user.middleName,
            lastName: user.lastName,
            phone: user.phone,
            email: user.email,
            gender: user.gender,
            birthDate: user.birthDate,
            nationality: user.nationality,
            address: user.address,
            deleted: false,
        });

        const savedPatient = await this.patientRepository.save(patient);
        await this.syncPatientDepartments(savedPatient.id, user);
    }

    private async updatePatientFromUser(patientId: number, user: User): Promise<void> {
        await this.patientRepository.update(patientId, {
            userId: user.id,
            firstName: user.firstName,
            middleName: user.middleName,
            lastName: user.lastName,
            phone: user.phone,
            email: user.email,
            gender: user.gender,
            birthDate: user.birthDate,
            nationality: user.nationality,
            address: user.address,
        });
    }

    private async syncPatientDepartments(patientId: number, user: User): Promise<void> {
        if (!user.departments) {
            return;
        }

        const patient = await this.patientRepository.findOne({
            where: { id: patientId },
            relations: ['departments'],
        });

        const currentDepartmentIds = patient.departments?.map(department => department.id) ?? [];
        const nextDepartmentIds = user.departments.map(department => department.id);
        const departmentIdsToAdd = nextDepartmentIds.filter(id => !currentDepartmentIds.includes(id));
        const departmentIdsToRemove = currentDepartmentIds.filter(id => !nextDepartmentIds.includes(id));

        if (departmentIdsToAdd.length || departmentIdsToRemove.length) {
            await this.patientRepository
                .createQueryBuilder()
                .relation(Patient, 'departments')
                .of(patientId)
                .addAndRemove(departmentIdsToAdd, departmentIdsToRemove);
        }
    }

    private async ensureCaregiverForUser(user: User): Promise<void> {
        if (!user.phone) {
            throw new BadRequestException('Phone is required to create a caregiver profile');
        }

        const existingCaregiver = await this.caregiverRepository.findOne({
            where: { userId: user.id },
        });

        const phoneOwner = await this.caregiverRepository.findOne({
            where: { phone: user.phone },
        });

        if (phoneOwner && phoneOwner.userId && phoneOwner.userId !== user.id) {
            throw new BadRequestException('Caregiver with this phone already exists');
        }

        if (phoneOwner && !phoneOwner.userId) {
            await this.updateCaregiverFromUser(phoneOwner.id, user);
            return;
        }

        if (existingCaregiver) {
            await this.updateCaregiverFromUser(existingCaregiver.id, user);
            return;
        }

        const caregiver = this.caregiverRepository.create({
            userId: user.id,
            firstName: user.firstName,
            middleName: user.middleName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
        });

        await this.caregiverRepository.save(caregiver);
    }

    private async updateCaregiverFromUser(caregiverId: number, user: User): Promise<void> {
        await this.caregiverRepository.update(caregiverId, {
            userId: user.id,
            firstName: user.firstName,
            middleName: user.middleName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
        });
    }
}
