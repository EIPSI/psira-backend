import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Assessment } from 'src/modules/assessment/models/assessment.model';
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
            .where('occurrence."startAt" < :to', { to: filter.to })
            .andWhere('occurrence."endAt" > :from', { from: filter.from });

        if (!filter.includeCancelled) {
            query
                .andWhere('session."clinicalStatus" != :cancelledSessionStatus', {
                    cancelledSessionStatus: ClinicalSessionStatus.CANCELLED,
                })
                .andWhere('occurrence."status" != :cancelledOccurrenceStatus', {
                    cancelledOccurrenceStatus: CalendarOccurrenceStatus.CANCELLED,
                });
        }

        if (filter.patientId) {
            query.andWhere('session."patientId" = :patientId', {
                patientId: filter.patientId,
            });
        }

        if (filter.therapistId) {
            query.andWhere('session."therapistId" = :therapistId', {
                therapistId: filter.therapistId,
            });
        }

        if (filter.supervisorId) {
            query.andWhere('session."supervisorId" = :supervisorId', {
                supervisorId: filter.supervisorId,
            });
        }

        if (filter.sessionKind) {
            query.andWhere('session."sessionKind" = :sessionKind', {
                sessionKind: filter.sessionKind,
            });
        }

        const sessions = await query.getMany();
        return sessions.map(session => ({
            id: `session:${session.id}`,
            type: CalendarEventType.SESSION,
            title: session.calendarOccurrence.title,
            description: session.clinicalHistory,
            startAt: session.calendarOccurrence.startAt,
            endAt: session.calendarOccurrence.endAt,
            status: session.calendarOccurrence.status,
            color: session.sessionKind === ClinicalSessionKind.SUPERVISION ? '#9254de' : '#13a8a8',
            editable: true,
            deletable: true,
            occurrenceId: session.calendarOccurrenceId,
            occurrenceType: session.calendarOccurrence.occurrenceType,
            patientId: session.patientId,
            therapistId: session.therapistId,
            supervisorId: session.supervisorId,
            clinicalSessionId: session.id,
            sessionKind: session.sessionKind,
            sessionNumber: session.sessionNumber,
        }));
    }

    private async getAssessmentEvents(filter: CalendarEventFilterInput): Promise<CalendarEvent[]> {
        const query = this.assessmentRepository
            .createQueryBuilder('assessment')
            .leftJoinAndSelect('assessment.calendarOccurrence', 'occurrence')
            .leftJoinAndSelect('assessment.assessmentType', 'assessmentType')
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
            query.andWhere('assessment."clinicianId" = :therapistId', {
                therapistId: filter.therapistId,
            });
        }

        const assessments = await query.getMany();
        return assessments.map(assessment => ({
            id: `assessment:${assessment.id}`,
            type: CalendarEventType.ASSESSMENT,
            title: assessment.assessmentType?.name || 'Evaluación',
            description: assessment.note,
            startAt: assessment.deliveryDate || assessment.date || assessment.createdAt,
            endAt: assessment.expirationDate || assessment.deliveryDate || assessment.createdAt,
            status: assessment.calendarOccurrence?.status,
            color: assessment.editableFromAssessmentList ? '#2f80ed' : '#722ed1',
            editable: assessment.editableFromAssessmentList,
            deletable: assessment.editableFromAssessmentList,
            occurrenceId: assessment.calendarOccurrenceId,
            occurrenceType: assessment.calendarOccurrence?.occurrenceType,
            patientId: assessment.patientId,
            therapistId: assessment.clinicianId,
            clinicalSessionId: assessment.clinicalSessionId,
            assessmentId: assessment.id,
            assessmentOrigin: assessment.origin,
        }));
    }
}
