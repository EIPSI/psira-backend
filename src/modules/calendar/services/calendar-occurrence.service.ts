import { ClinicalAccess } from 'src/shared/clinical-access';
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
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
            .leftJoin('patient.caseManagers', 'caseManager')
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
                '(occurrence."therapistId" = :therapistId OR responsibleUser.id = :therapistId OR caseManager.id = :therapistId)',
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

        const occurrences = await query.orderBy('occurrence.startAt', 'ASC').getMany();
        const viewer = await ClinicalAccess.viewer(currentUser.id), grants = await ClinicalAccess.grants(currentUser.id);
        await ClinicalAccess.loadAssessmentScopes(occurrences.flatMap(item => item.assessments || []));
        const visible: CalendarOccurrence[] = [];
        for (const occurrence of occurrences) {
            if (occurrence.clinicalSession) {
                const session = await ClinicalAccess.session(occurrence.clinicalSession.id);
                if (ClinicalAccess.canSession(session, viewer, grants, 'view')) visible.push(occurrence);
            } else if (occurrence.assessments?.length) {
                const access = await Promise.all(occurrence.assessments.map(assessment =>
                    ClinicalAccess.canAssessment(assessment, viewer, grants, 'view')));
                if (access.every(Boolean)) visible.push(occurrence);
            }
        }
        return visible;
    }

    async detachAndMoveOccurrence(
        occurrenceId: number,
        startAt: Date,
        endAt: Date,
        currentUser?: User,
    ): Promise<CalendarOccurrence> {
        if (endAt <= startAt) throw new BadRequestException('Event end must be after its start');
        const occurrence = await this.occurrenceRepository.findOneOrFail(
            occurrenceId, { relations: ['clinicalSession', 'assessments'] },
        );
        if (currentUser) {
            if (occurrence.clinicalSession) throw new BadRequestException('Session events must be moved through their session');
            if (!occurrence.assessments?.length) throw new ForbiddenException('No accessible evaluation belongs to this event');
            for (const assessment of occurrence.assessments) await ClinicalAccess.assertAssessment(assessment, currentUser, 'edit');
        }

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
