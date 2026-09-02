import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateFullAssessmentInput } from 'src/modules/assessment/dtos/create-assessment.input';
import { Assessment } from 'src/modules/assessment/models/assessment.model';
import { AssessmentService } from 'src/modules/assessment/services/assessment.service';
import { User } from 'src/modules/user/models/user.model';
import { In, Repository } from 'typeorm';
import { CalendarOccurrenceStatus } from '../enums/calendar-occurrence-status.enum';
import { CalendarOccurrenceType } from '../enums/calendar-occurrence-type.enum';
import { CalendarOccurrence } from '../models/calendar-occurrence.model';
import { GoogleCalendarSyncService } from './google-calendar-sync.service';

export interface CalendarOccurrenceFilter {
    patientId?: number;
    therapistId?: number;
    supervisorId?: number;
    occurrenceType?: CalendarOccurrenceType;
}

@Injectable()
export class CalendarOccurrenceService {
    constructor(
        @InjectRepository(CalendarOccurrence)
        private readonly occurrenceRepository: Repository<CalendarOccurrence>,
        @InjectRepository(Assessment)
        private readonly assessmentRepository: Repository<Assessment>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly assessmentService: AssessmentService,
        private readonly googleCalendarSyncService: GoogleCalendarSyncService,
    ) {}

    async getOccurrences(
        from: Date,
        to: Date,
        currentUser: User,
        filter: CalendarOccurrenceFilter = {},
    ): Promise<CalendarOccurrence[]> {
        const query = this.occurrenceRepository
            .createQueryBuilder('occurrence')
            .leftJoinAndSelect('occurrence.patient', 'patient')
            .leftJoinAndSelect('patient.departments', 'patientDepartment')
            .leftJoinAndSelect('occurrence.therapist', 'therapist')
            .leftJoinAndSelect('therapist.departments', 'therapistDepartment')
            .leftJoin('therapist.supervisors', 'therapistSupervisor')
            .leftJoinAndSelect('occurrence.supervisor', 'supervisor')
            .leftJoinAndSelect('supervisor.departments', 'supervisorDepartment')
            .leftJoinAndSelect('occurrence.responsibleUsers', 'responsibleUser')
            .leftJoinAndSelect('occurrence.clinicalSession', 'clinicalSession')
            .leftJoinAndSelect('occurrence.assessments', 'assessment')
            .where('occurrence."startAt" < :to', { to })
            .andWhere('occurrence."endAt" > :from', { from });

        if (filter.patientId) {
            query.andWhere('occurrence."patientId" = :patientId', {
                patientId: filter.patientId,
            });
        }

        if (filter.therapistId) {
            query.andWhere(
                '(occurrence."therapistId" = :therapistId OR responsibleUser.id = :therapistId)',
                { therapistId: filter.therapistId },
            );
        }

        if (filter.supervisorId) {
            query.andWhere(
                `(
                    occurrence."supervisorId" = :supervisorId
                    OR therapistSupervisor.id = :supervisorId
                    OR responsibleUser.id = :supervisorId
                )`,
                { supervisorId: filter.supervisorId },
            );
        }

        if (filter.occurrenceType) {
            query.andWhere('occurrence."occurrenceType" = :occurrenceType', {
                occurrenceType: filter.occurrenceType,
            });
        }

        query.andWhere(
            `(
                occurrence."therapistId" = :currentUserId
                OR occurrence."supervisorId" = :currentUserId
                OR therapistSupervisor.id = :currentUserId
                OR responsibleUser.id = :currentUserId
                OR patient."userId" = :currentUserId
                OR assessment."responderUserId" = :currentUserId
                OR assessment."clinicianId" = :currentUserId
            )`,
            { currentUserId: currentUser.id },
        );

        return query.orderBy('occurrence.startAt', 'ASC').getMany();
    }

    async detachAndMoveOccurrence(
        occurrenceId: number,
        startAt: Date,
        endAt: Date,
    ): Promise<CalendarOccurrence> {
        const occurrence = await this.occurrenceRepository.findOneOrFail(
            occurrenceId,
        );

        if (!occurrence.originalStartAt) {
            occurrence.originalStartAt = occurrence.startAt;
        }

        occurrence.startAt = startAt;
        occurrence.endAt = endAt;
        occurrence.isDetachedFromTemplate = true;

        const saved = await this.occurrenceRepository.save(occurrence);
        await this.syncAssessmentDatesForMovedOccurrence(saved);
        await this.googleCalendarSyncService.syncOccurrence(saved.id);
        return saved;
    }

    private async syncAssessmentDatesForMovedOccurrence(
        occurrence: CalendarOccurrence,
    ): Promise<void> {
        if (
            occurrence.occurrenceType !==
            CalendarOccurrenceType.INDEPENDENT_ASSESSMENT
        ) {
            return;
        }

        await this.assessmentRepository.update(
            { calendarOccurrenceId: occurrence.id },
            {
                deliveryDate: occurrence.startAt,
                expirationDate: occurrence.endAt,
            },
        );
    }

    async createAssessmentOccurrence(
        assessmentInput: CreateFullAssessmentInput,
        currentUser?: User,
    ): Promise<CalendarOccurrence> {
        const responsibleUserIds = this.uniqueIds([
            ...(assessmentInput.responsibleUserIds || []),
            assessmentInput.clinicianId,
        ]);
        if (responsibleUserIds[0]) {
            assessmentInput.clinicianId = responsibleUserIds[0];
        }
        const firstDate = assessmentInput.dates?.[0];
        const startAt = firstDate?.deliveryDate
            ? new Date(firstDate.deliveryDate)
            : new Date();
        const endAt = firstDate?.expirationDate
            ? new Date(firstDate.expirationDate)
            : new Date(startAt.getTime() + 60 * 60000);

        const occurrence = await this.occurrenceRepository.save(
            this.occurrenceRepository.create({
                occurrenceType: CalendarOccurrenceType.INDEPENDENT_ASSESSMENT,
                title: 'Evaluacion',
                startAt,
                endAt,
                timezone: 'UTC',
                status: CalendarOccurrenceStatus.SCHEDULED,
                patientId: assessmentInput.patientId,
                therapistId: assessmentInput.clinicianId,
            }),
        );
        await this.setOccurrenceResponsibleUsers(occurrence, responsibleUserIds);

        try {
            const assessment = await this.assessmentService.createNewAssessment(
                assessmentInput,
                currentUser,
            );
            assessment.calendarOccurrenceId = occurrence.id;
            await this.assessmentRepository.save(assessment);
            await this.setOccurrenceResponsibleUsers(occurrence, responsibleUserIds);
            await this.googleCalendarSyncService.syncOccurrence(occurrence.id);
            return this.occurrenceRepository.findOneOrFail(occurrence.id, {
                relations: ['assessments', 'patient', 'therapist', 'responsibleUsers'],
            });
        } catch (error) {
            await this.occurrenceRepository.delete(occurrence.id);
            throw error;
        }
    }

    private async setOccurrenceResponsibleUsers(
        occurrence: CalendarOccurrence,
        responsibleUserIds: number[],
    ): Promise<void> {
        const users = responsibleUserIds.length
            ? await this.userRepository.find({ where: { id: In(responsibleUserIds) } })
            : [];
        occurrence.responsibleUsers = users;
        await this.occurrenceRepository.save(occurrence);
    }

    private uniqueIds(ids: Array<number | undefined | null>): number[] {
        return [...new Set(
            ids
                .map(id => Number(id))
                .filter(id => Number.isFinite(id) && id > 0),
        )];
    }
}
