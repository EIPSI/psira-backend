import { TypeOrmQueryService } from "@nestjs-query/query-typeorm";
import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { SelectQueryBuilder, Repository } from "typeorm";
import { CaregiverInput } from "../dtos/caregiver.input";
import { Caregiver } from "../models/caregiver.model";
import { Filter, Query } from "@nestjs-query/core";
import { PatientCaregiver } from "../models/patient-caregiver.model";
import { Patient } from "src/modules/patient/models/patient.model";
import { EmergencyContact } from "src/modules/patient/models/emergency-contact.model";
import { RoleCode } from "src/modules/permission/enums/role-code.enum";
import { UserAccountProvisioningService } from "src/modules/user/services/user-account-provisioning.service";
import { User } from "src/modules/user/models/user.model";
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



    async assignedCaregiverIdsForUser(userId: number): Promise<number[]> {
        const rows = await this.patientCaregiverRepository
            .createQueryBuilder('patient_caregiver')
            .innerJoin('patient_caregiver.patient', 'patient')
            .innerJoin(
                'patient_case_manager',
                'patient_case_manager',
                'patient_case_manager."patientId" = patient.id AND patient_case_manager."userId" = :userId',
                { userId },
            )
            .select('DISTINCT patient_caregiver."caregiverId"', 'caregiver_id')
            .where('patient_caregiver."deletedAt" IS NULL')
            .andWhere('patient."deletedAt" IS NULL')
            .getRawMany();

        return rows
            .map(row => Number(row.caregiver_id))
            .filter(id => Number.isFinite(id));
    }


    async queryAssignedToCaseManager(query: Query<Caregiver>, userId: number): Promise<Caregiver[]> {
        const qb = this.assignedToCaseManagerQuery(userId);
        this.applyCaregiverFilter(qb, query.filter as any);
        this.applySorting(qb, query);
        this.applyPaging(qb, query);
        return qb.getMany();
    }

    async countAssignedToCaseManager(filter: Filter<Caregiver> | undefined, userId: number): Promise<number> {
        const qb = this.assignedToCaseManagerQuery(userId);
        this.applyCaregiverFilter(qb, filter as any);
        return qb.getCount();
    }

    private assignedToCaseManagerQuery(userId: number): SelectQueryBuilder<Caregiver> {
        return this.repo
            .createQueryBuilder('caregiver')
            .distinct(true)
            .leftJoinAndSelect('caregiver.patientCaregivers', 'patient_caregivers')
            .leftJoinAndSelect('patient_caregivers.patient', 'patient')
            .where('caregiver."deletedAt" IS NULL')
            .andWhere(qb => {
                const subQuery = qb
                    .subQuery()
                    .select('1')
                    .from('patient_caregiver', 'pc')
                    .innerJoin('patient', 'p', 'p.id = pc."patientId"')
                    .innerJoin(
                        'patient_case_manager',
                        'pcm',
                        'pcm."patientId" = pc."patientId" AND pcm."userId" = :userId',
                    )
                    .where('pc."caregiverId" = caregiver.id')
                    .andWhere('pc."deletedAt" IS NULL')
                    .andWhere('p."deletedAt" IS NULL')
                    .getQuery();

                return `EXISTS ${subQuery}`;
            }, { userId });
    }


    private applyCaregiverFilter(qb: SelectQueryBuilder<Caregiver>, filter?: any): void {
        if (!filter) return;

        const clauses = Array.isArray(filter.and) ? filter.and : [filter];
        clauses.forEach((clause: any, index: number) => {
            if (!clause || !Object.keys(clause).length) return;
            this.applyCaregiverFilterClause(qb, clause, `filter${index}`);
        });
    }

    private applyCaregiverFilterClause(qb: SelectQueryBuilder<Caregiver>, clause: any, prefix: string): void {
        if (Array.isArray(clause.or) && clause.or.length) {
            const orParts: string[] = [];
            const params: Record<string, any> = {};
            clause.or.forEach((item: any, index: number) => {
                ['firstName', 'middleName', 'lastName', 'email', 'phone'].forEach(field => {
                    const value = item?.[field]?.iLike;
                    if (value) {
                        const key = `${prefix}_${field}_${index}`;
                        orParts.push(`caregiver."${field}" ILIKE :${key}`);
                        params[key] = value;
                    }
                });
            });
            if (orParts.length) qb.andWhere(`(${orParts.join(' OR ')})`, params);
        }

        ['firstName', 'middleName', 'lastName', 'email', 'phone'].forEach(field => {
            const eqValue = clause?.[field]?.eq;
            const iLikeValue = clause?.[field]?.iLike;
            if (eqValue !== undefined) qb.andWhere(`caregiver."${field}" = :${prefix}_${field}_eq`, { [`${prefix}_${field}_eq`]: eqValue });
            if (iLikeValue !== undefined) qb.andWhere(`caregiver."${field}" ILIKE :${prefix}_${field}_ilike`, { [`${prefix}_${field}_ilike`]: iLikeValue });
        });

        const idEq = clause?.id?.eq;
        const idIn = clause?.id?.in;
        if (idEq !== undefined) qb.andWhere('caregiver.id = :idEq', { idEq });
        if (Array.isArray(idIn) && idIn.length) qb.andWhere('caregiver.id IN (:...idIn)', { idIn });
    }

    private applySorting(qb: SelectQueryBuilder<Caregiver>, query: Query<Caregiver>): void {
        const allowedFields = [
            'id',
            'firstName',
            'middleName',
            'lastName',
            'email',
            'phone',
            'street',
            'number',
            'apartment',
            'place',
            'postalCode',
            'country',
            'createdAt',
            'updatedAt',
        ];
        const sorting = query.sorting?.length ? query.sorting : [{ field: 'id', direction: 'DESC' as any }];
        sorting.forEach((sort: any, index: number) => {
            if (!allowedFields.includes(sort.field)) return;
            const direction = String(sort.direction || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
            const field = `caregiver."${sort.field}"`;
            if (index === 0) qb.orderBy(field, direction as any);
            else qb.addOrderBy(field, direction as any);
        });
    }

    private applyPaging(qb: SelectQueryBuilder<Caregiver>, query: Query<Caregiver>): void {
        const paging = query.paging as any;
        if (!paging) return;
        if (typeof paging.first === 'number') qb.take(paging.first);
        if (typeof paging.offset === 'number') qb.skip(paging.offset);
    }

    async deleteOne(id: number): Promise<Caregiver> {
        const caregiver = await this.repo.findOneOrFail(id);

        await this.repo.manager.transaction(async manager => {
            if (caregiver.userId) {
                await manager.getRepository(User).softDelete(caregiver.userId);
            }
            await manager.getRepository(Caregiver).softDelete(id);
        });

        return caregiver;
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
