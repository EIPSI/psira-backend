import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateFullAssessmentInput } from 'src/modules/assessment/dtos/create-assessment.input';
import { Assessment } from 'src/modules/assessment/models/assessment.model';
import { AssessmentService } from 'src/modules/assessment/services/assessment.service';
import { User } from 'src/modules/user/models/user.model';
import { Repository } from 'typeorm';
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
            .leftJoinAndSelect('occurrence.therapist', 'therapist')
            .leftJoin('therapist.supervisors', 'therapistSupervisor')
            .leftJoinAndSelect('occurrence.supervisor', 'supervisor')
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
            query.andWhere('occurrence."therapistId" = :therapistId', {
                therapistId: filter.therapistId,
            });
        }

        if (filter.supervisorId) {
            query.andWhere(
                `(
                    occurrence."supervisorId" = :supervisorId
                    OR therapistSupervisor.id = :supervisorId
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
        await this.googleCalendarSyncService.syncOccurrence(saved.id);
        return saved;
    }

    async createAssessmentOccurrence(
        assessmentInput: CreateFullAssessmentInput,
        currentUser?: User,
    ): Promise<CalendarOccurrence> {
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

        try {
            const assessment = await this.assessmentService.createNewAssessment(
                assessmentInput,
                currentUser,
            );
            assessment.calendarOccurrenceId = occurrence.id;
            await this.assessmentRepository.save(assessment);
            await this.googleCalendarSyncService.syncOccurrence(occurrence.id);
            return this.occurrenceRepository.findOneOrFail(occurrence.id, {
                relations: ['assessments', 'patient', 'therapist'],
            });
        } catch (error) {
            await this.occurrenceRepository.delete(occurrence.id);
            throw error;
        }
    }
}
