import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Assessment } from 'src/modules/assessment/models/assessment.model';
import { AssessmentOrigin } from 'src/modules/assessment/enums/assessment-origin.enum';
import { AssessmentStatus } from 'src/modules/questionnaire/enums/assessment-status.enum';
import { ClinicalSessionCancellationType } from 'src/modules/clinical-session/enums/clinical-session-cancellation-type.enum';
import { ClinicalSessionKind } from 'src/modules/clinical-session/enums/clinical-session-kind.enum';
import { ClinicalSessionStatus } from 'src/modules/clinical-session/enums/clinical-session-status.enum';
import { ClinicalSession } from 'src/modules/clinical-session/models/clinical-session.model';
import { Repository } from 'typeorm';
import { CalendarEventFilterInput } from '../dtos/calendar-event.input';
import { CalendarEventType } from '../enums/calendar-event-type.enum';
import { CalendarOccurrenceStatus } from '../enums/calendar-occurrence-status.enum';
import { CalendarEvent } from '../models/calendar-event.model';

@Injectable()
export class CalendarEventService {
    constructor(
        @InjectRepository(ClinicalSession)
        private readonly clinicalSessionRepository: Repository<ClinicalSession>,
        @InjectRepository(Assessment)
        private readonly assessmentRepository: Repository<Assessment>,
    ) {}

    async getCalendarEvents(filter: CalendarEventFilterInput): Promise<CalendarEvent[]> {
        const includeSessions = this.includesType(filter, CalendarEventType.SESSION);
        const includeAssessments = this.includesType(filter, CalendarEventType.ASSESSMENT);
        const events: CalendarEvent[] = [];

        if (includeSessions) {
            events.push(...await this.getSessionEvents(filter));
        }

        if (includeAssessments) {
            events.push(...await this.getAssessmentEvents(filter));
        }

        return events.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    }

    private includesType(filter: CalendarEventFilterInput, type: CalendarEventType): boolean {
        return !filter.types?.length || filter.types.includes(type);
    }

    private async getSessionEvents(filter: CalendarEventFilterInput): Promise<CalendarEvent[]> {
        const query = this.clinicalSessionRepository
            .createQueryBuilder('session')
            .innerJoinAndSelect('session.calendarOccurrence', 'occurrence')
            .leftJoinAndSelect('session.responsibleUsers', 'responsibleUser')
            .where('occurrence."startAt" < :to', { to: filter.to })
            .andWhere('occurrence."endAt" > :from', { from: filter.from })
            .andWhere(
                '(session."cancellationType" IS NULL OR session."cancellationType" != :rescheduledCancellationType)',
                { rescheduledCancellationType: ClinicalSessionCancellationType.RESCHEDULED },
            );

        if (!filter.includeCancelled) {
            query
                .andWhere(
                    `(
                        session."clinicalStatus" != :cancelledSessionStatus
                        OR session."cancellationType" = :noShowCancellationType
                    )`,
                    {
                        cancelledSessionStatus: ClinicalSessionStatus.CANCELLED,
                        noShowCancellationType: ClinicalSessionCancellationType.NO_SHOW,
                    },
                )
                .andWhere(
                    `(
                        occurrence."status" != :cancelledOccurrenceStatus
                        OR session."cancellationType" = :noShowCancellationType
                    )`,
                    {
                        cancelledOccurrenceStatus: CalendarOccurrenceStatus.CANCELLED,
                        noShowCancellationType: ClinicalSessionCancellationType.NO_SHOW,
                    },
                );
        }

        if (filter.patientId) {
            query.andWhere('session."patientId" = :patientId', {
                patientId: filter.patientId,
            });
        }

        if (filter.therapistId) {
            query.andWhere(
                '(session."therapistId" = :therapistId OR responsibleUser.id = :therapistId)',
                { therapistId: filter.therapistId },
            );
        }

        if (filter.supervisorId) {
            query.andWhere(
                '(session."supervisorId" = :supervisorId OR responsibleUser.id = :supervisorId)',
                { supervisorId: filter.supervisorId },
            );
        }

        if (filter.sessionKind) {
            query.andWhere('session."sessionKind" = :sessionKind', {
                sessionKind: filter.sessionKind,
            });
        }

        const sessions = await query.getMany();
        return sessions.map(session => {
            const cancelled = session.clinicalStatus === ClinicalSessionStatus.CANCELLED;
            const noShow = session.cancellationType === ClinicalSessionCancellationType.NO_SHOW;
            return {
            id: `session:${session.id}`,
            type: CalendarEventType.SESSION,
            title: session.calendarOccurrence.title,
            description: session.clinicalHistory,
            startAt: session.calendarOccurrence.startAt,
            endAt: session.calendarOccurrence.endAt,
            status: session.calendarOccurrence.status,
            color: noShow
                ? '#8c8c8c'
                : session.sessionKind === ClinicalSessionKind.SUPERVISION ? '#9254de' : '#13a8a8',
            editable: !cancelled,
            deletable: !cancelled,
            occurrenceId: session.calendarOccurrenceId,
            occurrenceType: session.calendarOccurrence.occurrenceType,
            patientId: session.patientId,
            therapistId: session.therapistId,
            supervisorId: session.supervisorId,
            responsibleUserIds: (session.responsibleUsers || []).map(user => user.id),
            clinicalSessionId: session.id,
            sessionKind: session.sessionKind,
            sessionNumber: session.sessionNumber || session.cancelledSessionNumber,
            modality: session.modality,
            cancellationType: session.cancellationType,
            cancellationLabel: session.cancellationLabel,
            cancellationReasonSnapshot: session.cancellationReasonSnapshot,
            cancellationComment: session.cancellationComment,
        };
        });
    }

    private async getAssessmentEvents(filter: CalendarEventFilterInput): Promise<CalendarEvent[]> {
        const query = this.assessmentRepository
            .createQueryBuilder('assessment')
            .leftJoinAndSelect('assessment.calendarOccurrence', 'occurrence')
            .leftJoinAndSelect('assessment.assessmentType', 'assessmentType')
            .leftJoinAndSelect('assessment.responsibleUsers', 'responsibleUser')
            .where('assessment."deliveryDate" IS NOT NULL')
            .andWhere('assessment."expirationDate" IS NOT NULL')
            .andWhere('assessment."deliveryDate" < :to', { to: filter.to })
            .andWhere('assessment."expirationDate" > :from', { from: filter.from })
            .andWhere('(assessment."deleted" IS NULL OR assessment."deleted" = false)');

        if (!filter.includeCancelled) {
            query.andWhere('assessment."status" != :cancelledStatus', {
                cancelledStatus: 'CANCELLED',
            });
        }

        if (filter.patientId) {
            query.andWhere('assessment."patientId" = :patientId', {
                patientId: filter.patientId,
            });
        }

        if (filter.therapistId) {
            query.andWhere(
                '(assessment."clinicianId" = :therapistId OR responsibleUser.id = :therapistId)',
                { therapistId: filter.therapistId },
            );
        }

        const assessments = await query.getMany();
        return assessments.map(assessment => {
            const sessionBased = assessment.origin === AssessmentOrigin.SESSION_BASED;
            const answered = [
                AssessmentStatus.COMPLETED,
                AssessmentStatus.PARTIALLY_COMPLETED,
            ].includes(assessment.status as AssessmentStatus);
            const cancelled = assessment.status === AssessmentStatus.CANCELLED;
            return {
            id: `assessment:${assessment.id}`,
            type: CalendarEventType.ASSESSMENT,
            title: assessment.assessmentType?.name || 'Evaluación',
            description: assessment.note,
            startAt: assessment.deliveryDate || assessment.date || assessment.createdAt,
            endAt: assessment.expirationDate || assessment.deliveryDate || assessment.createdAt,
            status: assessment.calendarOccurrence?.status,
            color: assessment.editableFromAssessmentList ? '#2f80ed' : '#722ed1',
            editable: assessment.editableFromAssessmentList,
            deletable: !cancelled && (assessment.editableFromAssessmentList || (sessionBased && !answered)),
            occurrenceId: assessment.calendarOccurrenceId,
            occurrenceType: assessment.calendarOccurrence?.occurrenceType,
            patientId: assessment.patientId,
            therapistId: assessment.clinicianId,
            responsibleUserIds: (assessment.responsibleUsers || []).map(user => user.id),
            clinicalSessionId: assessment.clinicalSessionId,
            assessmentId: assessment.id,
            clinicalSessionResourceId: assessment.clinicalSessionResourceId,
            assessmentOrigin: assessment.origin,
        };
        });
    }
}
