import { TypeOrmQueryService } from "@nestjs-query/query-typeorm";
import { ConflictException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, SelectQueryBuilder } from "typeorm";
import { PatientCaregiverInput } from "../dtos/patient.caregiver.input";
import { PatientCaregiver } from "../models/patient-caregiver.model";
import { Filter, Query } from "@nestjs-query/core";
@Injectable()
export class PatientCaregiverService extends TypeOrmQueryService<PatientCaregiver> {

    constructor(@InjectRepository(PatientCaregiver) repo: Repository<PatientCaregiver>) {
        super(repo, { useSoftDelete: true });
    }

    async queryAssignedToCaseManager(query: Query<PatientCaregiver>, userId: number): Promise<PatientCaregiver[]> {
        const qb = this.assignedToCaseManagerQuery(userId);
        this.applyPatientCaregiverFilter(qb, query.filter as any);
        this.applySorting(qb, query);
        this.applyPaging(qb, query);
        return qb.getMany();
    }

    async countAssignedToCaseManager(filter: Filter<PatientCaregiver> | undefined, userId: number): Promise<number> {
        const qb = this.assignedToCaseManagerQuery(userId);
        this.applyPatientCaregiverFilter(qb, filter as any);
        return qb.getCount();
    }

    private assignedToCaseManagerQuery(userId: number): SelectQueryBuilder<PatientCaregiver> {
        return this.repo
            .createQueryBuilder('patient_caregiver')
            .distinct(true)
            .leftJoinAndSelect('patient_caregiver.caregiver', 'caregiver')
            .leftJoinAndSelect('patient_caregiver.patient', 'patient')
            .innerJoin(
                'patient_case_manager',
                'patient_case_manager',
                'patient_case_manager."patientId" = patient.id AND patient_case_manager."userId" = :userId',
                { userId },
            )
            .where('patient_caregiver."deletedAt" IS NULL')
            .andWhere('patient."deletedAt" IS NULL')
            .andWhere('caregiver."deletedAt" IS NULL');
    }

    private applyPatientCaregiverFilter(qb: SelectQueryBuilder<PatientCaregiver>, filter?: any): void {
        if (!filter) return;

        const clauses = Array.isArray(filter.and) ? filter.and : [filter];
        clauses.forEach((clause: any, index: number) => {
            if (!clause || !Object.keys(clause).length) return;
            this.applyPatientCaregiverFilterClause(qb, clause, `filter${index}`);
        });
    }

    private applyPatientCaregiverFilterClause(qb: SelectQueryBuilder<PatientCaregiver>, clause: any, prefix: string): void {
        if (Array.isArray(clause.or) && clause.or.length) {
            const orParts: string[] = [];
            const params: Record<string, any> = {};
            clause.or.forEach((item: any, index: number) => {
                ['relation', 'note'].forEach(field => {
                    const value = item?.[field]?.iLike;
                    if (value) {
                        const key = `${prefix}_${field}_${index}`;
                        orParts.push(`patient_caregiver."${field}" ILIKE :${key}`);
                        params[key] = value;
                    }
                });
            });
            if (orParts.length) qb.andWhere(`(${orParts.join(' OR ')})`, params);
        }

        ['relation', 'note'].forEach(field => {
            const eqValue = clause?.[field]?.eq;
            const iLikeValue = clause?.[field]?.iLike;
            if (eqValue !== undefined) qb.andWhere(`patient_caregiver."${field}" = :${prefix}_${field}_eq`, { [`${prefix}_${field}_eq`]: eqValue });
            if (iLikeValue !== undefined) qb.andWhere(`patient_caregiver."${field}" ILIKE :${prefix}_${field}_ilike`, { [`${prefix}_${field}_ilike`]: iLikeValue });
        });

        this.applyNumberFilter(qb, 'patient_caregiver.id', clause?.id, `${prefix}_id`);
        this.applyNumberFilter(qb, 'patient_caregiver."patientId"', clause?.patientId, `${prefix}_patientId`);
        this.applyNumberFilter(qb, 'patient_caregiver."caregiverId"', clause?.caregiverId, `${prefix}_caregiverId`);
        this.applyNumberFilter(qb, 'patient.id', clause?.patient?.id, `${prefix}_patient_id`);
        this.applyNumberFilter(qb, 'caregiver.id', clause?.caregiver?.id, `${prefix}_caregiver_id`);
    }

    private applyNumberFilter(qb: SelectQueryBuilder<PatientCaregiver>, field: string, value: any, prefix: string): void {
        if (!value) return;
        if (value.eq !== undefined) qb.andWhere(`${field} = :${prefix}_eq`, { [`${prefix}_eq`]: value.eq });
        if (Array.isArray(value.in) && value.in.length) qb.andWhere(`${field} IN (:...${prefix}_in)`, { [`${prefix}_in`]: value.in });
    }

    private applySorting(qb: SelectQueryBuilder<PatientCaregiver>, query: Query<PatientCaregiver>): void {
        const allowedFields = ['id', 'patientId', 'caregiverId', 'relation', 'note', 'createdAt', 'updatedAt'];
        const sorting = query.sorting?.length ? query.sorting : [{ field: 'id', direction: 'DESC' as any }];
        sorting.forEach((sort: any, index: number) => {
            if (!allowedFields.includes(sort.field)) return;
            const direction = String(sort.direction || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
            const field = `patient_caregiver."${sort.field}"`;
            if (index === 0) qb.orderBy(field, direction as any);
            else qb.addOrderBy(field, direction as any);
        });
    }

    private applyPaging(qb: SelectQueryBuilder<PatientCaregiver>, query: Query<PatientCaregiver>): void {
        const paging = query.paging as any;
        if (!paging) return;
        if (typeof paging.first === 'number') qb.take(paging.first);
        if (typeof paging.offset === 'number') qb.skip(paging.offset);
    }

    async insert(patientCaregiver: PatientCaregiverInput) {
        const isExisting = await this.repo.findOne({ where: { ...patientCaregiver } });
        if (isExisting) throw new ConflictException();

        let newPatientCaregiver = this.repo.create();
        newPatientCaregiver = this.repo.merge(newPatientCaregiver, patientCaregiver);
        return this.repo.save(newPatientCaregiver)
    }
}
