import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateFullAssessmentInput } from 'src/modules/assessment/dtos/create-assessment.input';
import { Assessment } from 'src/modules/assessment/models/assessment.model';
import { AssessmentService } from 'src/modules/assessment/services/assessment.service';
import { CalendarOccurrenceStatus } from 'src/modules/calendar/enums/calendar-occurrence-status.enum';
import { CalendarOccurrenceType } from 'src/modules/calendar/enums/calendar-occurrence-type.enum';
import { CalendarOccurrence } from 'src/modules/calendar/models/calendar-occurrence.model';
import { CalendarOccurrenceService } from 'src/modules/calendar/services/calendar-occurrence.service';
import { GoogleCalendarSyncService } from 'src/modules/calendar/services/google-calendar-sync.service';
import { ResourceActivationAnchor } from 'src/modules/evaluation-scheme/enums/resource-activation-anchor.enum';
import { SchemeResourceTemplate } from 'src/modules/evaluation-scheme/models/scheme-resource-template.model';
import { SchemeSessionTemplate } from 'src/modules/evaluation-scheme/models/scheme-session-template.model';
import { Patient } from 'src/modules/patient/models/patient.model';
import { AssessmentStatus } from 'src/modules/questionnaire/enums/assessment-status.enum';
import { User } from 'src/modules/user/models/user.model';
import { Repository } from 'typeorm';
import {
    CancelClinicalSessionInput,
    CreateClinicalSessionInput,
    CreateClinicalSessionResourceInput,
    ClinicalSessionListFilterInput,
    defaultInformantType,
    MoveClinicalSessionInput,
    UpdateClinicalSessionInput,
} from '../dtos/clinical-session.input';
import { ClinicalSessionResourceKind } from '../enums/clinical-session-resource-kind.enum';
import { ClinicalSessionResourceStatus } from '../enums/clinical-session-resource-status.enum';
import { ClinicalSessionKind } from '../enums/clinical-session-kind.enum';
import { ClinicalSessionStatus } from '../enums/clinical-session-status.enum';
import { ClinicalSessionResource } from '../models/clinical-session-resource.model';
import { ClinicalSession } from '../models/clinical-session.model';
import { ClinicalSessionTimingService } from './clinical-session-timing.service';

@Injectable()
export class ClinicalSessionSchedulingService {
    constructor(
        @InjectRepository(CalendarOccurrence)
        private readonly occurrenceRepository: Repository<CalendarOccurrence>,
        @InjectRepository(ClinicalSession)
        private readonly clinicalSessionRepository: Repository<ClinicalSession>,
        @InjectRepository(ClinicalSessionResource)
        private readonly resourceRepository: Repository<ClinicalSessionResource>,
        @InjectRepository(SchemeSessionTemplate)
        private readonly sessionTemplateRepository: Repository<SchemeSessionTemplate>,
        @InjectRepository(SchemeResourceTemplate)
        private readonly schemeResourceTemplateRepository: Repository<SchemeResourceTemplate>,
        @InjectRepository(Patient)
        private readonly patientRepository: Repository<Patient>,
        @InjectRepository(Assessment)
        private readonly assessmentRepository: Repository<Assessment>,
        private readonly assessmentService: AssessmentService,
        private readonly calendarOccurrenceService: CalendarOccurrenceService,
        private readonly googleCalendarSyncService: GoogleCalendarSyncService,
        private readonly timingService: ClinicalSessionTimingService,
    ) {}

    async createClinicalSession(
        input: CreateClinicalSessionInput,
        currentUser?: User,
    ): Promise<ClinicalSession> {
        this.validateSessionWindow(input.startAt, input.endAt);
        this.normalizeSchemeIds(input);
        await this.resolveSchemeSessionNumber(input);
        const resources = input.resources?.length
            ? input.resources
            : await this.buildResourcesFromScheme(input, currentUser);

        const occurrence = await this.occurrenceRepository.save(
            this.occurrenceRepository.create({
                occurrenceType:
                    input.sessionKind === ClinicalSessionKind.SUPERVISION
                        ? CalendarOccurrenceType.SUPERVISION
                        : CalendarOccurrenceType.CLINICAL_SESSION,
                title: input.title,
                startAt: input.startAt,
                endAt: input.endAt,
                timezone: input.timezone || 'UTC',
                status: CalendarOccurrenceStatus.SCHEDULED,
                schemeId: input.schemeId,
                schemeAssignmentId: input.schemeAssignmentId,
                patientId: input.patientId,
                therapistId: input.therapistId,
                supervisorId: input.supervisorId,
            }),
        );

        const session = await this.clinicalSessionRepository.save(
            this.clinicalSessionRepository.create({
                calendarOccurrenceId: occurrence.id,
                sessionTemplateId: input.sessionTemplateId,
                sessionKind: input.sessionKind,
                sessionNumber: input.sessionNumber,
                patientId: input.patientId,
                therapistId: input.therapistId,
                supervisorId: input.supervisorId,
                clinicalStatus: ClinicalSessionStatus.SCHEDULED,
            }),
        );

        try {
            for (const resourceInput of resources || []) {
                await this.createResourceForSession(
                    session,
                    occurrence,
                    resourceInput,
                    input,
                    currentUser,
                );
            }
        } catch (error) {
            await this.cleanupFailedSessionCreate(session.id, occurrence.id);
            throw error;
        }

        await this.googleCalendarSyncService.syncOccurrence(occurrence.id);

        return this.clinicalSessionRepository.findOneOrFail(session.id, {
            relations: ['calendarOccurrence', 'resources', 'resources.assessment'],
        });
    }

    async moveClinicalSession(
        input: MoveClinicalSessionInput,
        currentUser?: User,
    ): Promise<ClinicalSession> {
        this.validateSessionWindow(input.startAt, input.endAt);

        const session = await this.clinicalSessionRepository.findOneOrFail(
            input.clinicalSessionId,
            {
                relations: [
                    'calendarOccurrence',
                    'resources',
                    'resources.assessment',
                ],
            },
        );

        this.assertCanManageSession(session, currentUser);

        const occurrence = await this.calendarOccurrenceService.detachAndMoveOccurrence(
            session.calendarOccurrenceId,
            input.startAt,
            input.endAt,
        );

        for (const resource of session.resources || []) {
            await this.rescheduleResource(
                session,
                occurrence,
                resource,
            );
        }

        await this.googleCalendarSyncService.syncOccurrence(occurrence.id);

        return this.clinicalSessionRepository.findOneOrFail(session.id, {
            relations: ['calendarOccurrence', 'resources', 'resources.assessment'],
        });
    }

    async getClinicalSessions(
        filter: ClinicalSessionListFilterInput = {},
    ): Promise<ClinicalSession[]> {
        const query = this.clinicalSessionRepository
            .createQueryBuilder('session')
            .leftJoinAndSelect('session.calendarOccurrence', 'occurrence')
            .leftJoinAndSelect('session.patient', 'patient')
            .leftJoinAndSelect('session.therapist', 'therapist')
            .leftJoinAndSelect('session.supervisor', 'supervisor')
            .leftJoinAndSelect('session.resources', 'resource')
            .leftJoinAndSelect('resource.assessment', 'assessment')
            .leftJoinAndSelect('assessment.assessmentType', 'assessmentType')
            .where('1 = 1');

        if (!filter.includeCancelled) {
            query.andWhere('session."clinicalStatus" != :cancelledStatus', {
                cancelledStatus: ClinicalSessionStatus.CANCELLED,
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

        if (filter.clinicalStatus) {
            query.andWhere('session."clinicalStatus" = :clinicalStatus', {
                clinicalStatus: filter.clinicalStatus,
            });
        }

        return query.orderBy('occurrence."startAt"', 'DESC').getMany();
    }

    async updateClinicalSession(
        input: UpdateClinicalSessionInput,
        currentUser?: User,
    ): Promise<ClinicalSession> {
        const session = await this.clinicalSessionRepository.findOneOrFail(
            input.clinicalSessionId,
            {
                relations: ['calendarOccurrence', 'resources', 'resources.assessment'],
            },
        );

        this.assertCanManageSession(session, currentUser);

        if (input.startAt || input.endAt) {
            const startAt = input.startAt || session.calendarOccurrence.startAt;
            const endAt = input.endAt || session.calendarOccurrence.endAt;
            await this.moveClinicalSession({
                clinicalSessionId: session.id,
                startAt,
                endAt,
            }, currentUser);
        }

        if (input.clinicalHistory !== undefined) {
            session.clinicalHistory = input.clinicalHistory;
            await this.clinicalSessionRepository.save(session);
        }

        return this.clinicalSessionRepository.findOneOrFail(session.id, {
            relations: [
                'calendarOccurrence',
                'patient',
                'therapist',
                'supervisor',
                'resources',
                'resources.assessment',
                'resources.assessment.assessmentType',
            ],
        });
    }

    async cancelClinicalSession(
        input: CancelClinicalSessionInput,
    ): Promise<ClinicalSession> {
        const session = await this.clinicalSessionRepository.findOneOrFail(
            input.clinicalSessionId,
            {
                relations: [
                    'calendarOccurrence',
                    'resources',
                    'resources.assessment',
                ],
            },
        );

        session.clinicalStatus = ClinicalSessionStatus.CANCELLED;
        await this.clinicalSessionRepository.save(session);

        session.calendarOccurrence.status = CalendarOccurrenceStatus.CANCELLED;
        session.calendarOccurrence.cancellationReason = input.cancellationReason;
        await this.occurrenceRepository.save(session.calendarOccurrence);

        for (const resource of session.resources || []) {
            resource.status = ClinicalSessionResourceStatus.CANCELLED;
            await this.resourceRepository.save(resource);
            if (resource.assessmentId) {
                await this.assessmentService.deleteAssessment(resource.assessmentId, true);
            }
        }

        if (input.renumberFutureSessions) {
            await this.renumberFutureSessionsAfterCancellation(session);
            session.sessionNumber = null;
            await this.clinicalSessionRepository.save(session);
        }

        await this.googleCalendarSyncService.syncOccurrence(session.calendarOccurrenceId);

        return this.clinicalSessionRepository.findOneOrFail(session.id, {
            relations: ['calendarOccurrence', 'resources', 'resources.assessment'],
        });
    }

    private async createResourceForSession(
        session: ClinicalSession,
        occurrence: CalendarOccurrence,
        resourceInput: CreateClinicalSessionResourceInput,
        sessionInput: CreateClinicalSessionInput,
        currentUser?: User,
        replacedResourceId?: number,
    ): Promise<ClinicalSessionResource> {
        const timing = this.resolveResourceTiming(
            occurrence.startAt,
            occurrence.endAt,
            resourceInput,
        );

        const resource = await this.resourceRepository.save(
            this.resourceRepository.create({
                clinicalSessionId: session.id,
                resourceTemplateId: resourceInput.resourceTemplateId,
                resourceKind: resourceInput.resourceKind,
                status: ClinicalSessionResourceStatus.PENDING,
                activationAnchor: resourceInput.activationAnchor,
                activationOffsetMinutes: resourceInput.activationOffsetMinutes,
                availabilityDurationMinutes: resourceInput.availabilityDurationMinutes,
                reminderMinutes: resourceInput.reminderMinutes || [],
                activationAt: timing.activationAt,
                expirationAt: timing.expirationAt,
                replacedResourceId,
            }),
        );

        const assessment = await this.createLinkedAssessment(
            session,
            occurrence,
            resource,
            resourceInput,
            sessionInput,
            currentUser,
        );

        if (assessment) {
            resource.assessmentId = assessment.id;
            await this.resourceRepository.save(resource);
        }

        return resource;
    }

    private assertCanManageSession(session: ClinicalSession, currentUser?: User): void {
        if (!currentUser) return;
        if (session.sessionKind === ClinicalSessionKind.SUPERVISION) {
            if (session.supervisorId && session.supervisorId !== currentUser.id) {
                throw new BadRequestException('Only the assigned supervisor can edit this session');
            }
            return;
        }

        if (session.therapistId && session.therapistId !== currentUser.id) {
            throw new BadRequestException('Only the assigned therapist can edit this session');
        }
    }

    private async renumberFutureSessionsAfterCancellation(
        cancelledSession: ClinicalSession,
    ): Promise<void> {
        if (!cancelledSession.sessionNumber) return;

        const query = this.clinicalSessionRepository
            .createQueryBuilder('session')
            .innerJoinAndSelect('session.calendarOccurrence', 'occurrence')
            .where('session."sessionNumber" > :sessionNumber', {
                sessionNumber: cancelledSession.sessionNumber,
            })
            .andWhere('session."clinicalStatus" != :cancelledStatus', {
                cancelledStatus: ClinicalSessionStatus.CANCELLED,
            })
            .orderBy('session."sessionNumber"', 'ASC');

        if (cancelledSession.patientId) {
            query.andWhere('session."patientId" = :patientId', {
                patientId: cancelledSession.patientId,
            });
        }

        if (cancelledSession.calendarOccurrence?.schemeId) {
            query.andWhere('occurrence."schemeId" = :schemeId', {
                schemeId: cancelledSession.calendarOccurrence.schemeId,
            });
        }

        const futureSessions = await query.getMany();
        for (const futureSession of futureSessions) {
            futureSession.sessionNumber = futureSession.sessionNumber - 1;
            await this.clinicalSessionRepository.save(futureSession);
        }
    }

    private async resolveSchemeSessionNumber(
        input: CreateClinicalSessionInput,
    ): Promise<void> {
        const primarySchemeId = this.primarySchemeId(input);
        if (!primarySchemeId) return;

        const maxSession = await this.clinicalSessionRepository
            .createQueryBuilder('session')
            .innerJoin('session.calendarOccurrence', 'occurrence')
            .where('occurrence."schemeId" = :schemeId', { schemeId: primarySchemeId })
            .andWhere(
                input.patientId
                    ? 'session."patientId" = :patientId'
                    : 'session."patientId" IS NULL',
                { patientId: input.patientId },
            )
            .select('MAX(session."sessionNumber")', 'max')
            .getRawOne();

        const nextSessionNumber = Number(maxSession?.max || 0) + 1;
        if (!input.sessionNumber) {
            input.sessionNumber = nextSessionNumber;
            return;
        }

        if (input.sessionNumber < nextSessionNumber) {
            throw new BadRequestException(
                `Session number must be ${nextSessionNumber} or greater for this scheme`,
            );
        }
    }

    private async buildResourcesFromScheme(
        input: CreateClinicalSessionInput,
        currentUser?: User,
    ): Promise<CreateClinicalSessionResourceInput[]> {
        const schemeIds = this.schemeIds(input);
        if (!schemeIds.length || !input.sessionNumber) return [];

        const sessionTemplates = await this.sessionTemplateRepository.find({
            where: schemeIds.map(schemeId => ({ schemeId })),
        });
        if (!sessionTemplates.length) return [];

        const resourceTemplates = await this.schemeResourceTemplateRepository.find({
            where: sessionTemplates.map(sessionTemplate => ({
                sessionTemplateId: sessionTemplate.id,
            })),
        });

        const patient = input.patientId
            ? await this.patientRepository.findOne(input.patientId)
            : null;
        const responderUserId =
            input.targetUserId ||
            patient?.userId ||
            input.therapistId ||
            currentUser?.id;
        const clinicianId = input.therapistId || currentUser?.id;

        return resourceTemplates
            .filter(resourceTemplate =>
                this.resourceAppliesToSession(resourceTemplate, input.sessionNumber),
            )
            .map(resourceTemplate => ({
                resourceTemplateId: resourceTemplate.id,
                resourceKind: resourceTemplate.resourceKind,
                assessmentTypeId: resourceTemplate.assessmentTypeId,
                questionnaires: resourceTemplate.questionnaireIds || [],
                questionnaireBundles: resourceTemplate.questionnaireBundleIds || [],
                responderUserId,
                clinicianId,
                informantType: resourceTemplate.informantType,
                activationAnchor: resourceTemplate.activationAnchor,
                activationOffsetMinutes: resourceTemplate.activationOffsetMinutes,
                availabilityDurationMinutes:
                    resourceTemplate.availabilityDurationMinutes,
                reminderMinutes: resourceTemplate.reminderMinutes || [],
            }));
    }

    private resourceAppliesToSession(
        resourceTemplate: SchemeResourceTemplate,
        sessionNumber: number,
    ): boolean {
        if (resourceTemplate.sessionSelector) {
            return this.sessionSelectorIncludes(
                resourceTemplate.sessionSelector,
                sessionNumber,
            );
        }

        if (resourceTemplate.everyNSessions) {
            const start = resourceTemplate.startSessionNumber || resourceTemplate.everyNSessions;
            const end = resourceTemplate.endSessionNumber;
            if (sessionNumber < start) return false;
            if (end && sessionNumber > end) return false;
            return (sessionNumber - start) % resourceTemplate.everyNSessions === 0;
        }

        return false;
    }

    private sessionSelectorIncludes(selector: string, sessionNumber: number): boolean {
        return selector
            .split(',')
            .map(part => part.trim())
            .filter(Boolean)
            .some(part => {
                const [start, end] = part.split('-').map(value => Number(value.trim()));
                if (!Number.isFinite(start)) return false;
                if (!end) return start === sessionNumber;
                return sessionNumber >= start && sessionNumber <= end;
            });
    }

    private async rescheduleResource(
        session: ClinicalSession,
        occurrence: CalendarOccurrence,
        resource: ClinicalSessionResource,
    ): Promise<void> {
        if (!this.isAssessmentResource(resource.resourceKind)) return;
        if (
            [
                ClinicalSessionResourceStatus.DETACHED,
                ClinicalSessionResourceStatus.CANCELLED,
            ].includes(resource.status)
        ) {
            return;
        }

        const assessment = resource.assessment || (resource.assessmentId
            ? await this.assessmentRepository.findOne(resource.assessmentId)
            : null);

        if (!assessment) return;

        if (this.isAssessmentAnswered(assessment)) {
            const replacement = await this.detachAnsweredResourceAndReplace(
                session,
                occurrence,
                resource,
                assessment,
            );
            resource.replacementResourceId = replacement.id;
            await this.resourceRepository.save(resource);
            return;
        }

        const timing = this.resolveResourceTiming(occurrence.startAt, occurrence.endAt, {
            resourceKind: resource.resourceKind,
            activationAnchor: resource.activationAnchor,
            activationOffsetMinutes: resource.activationOffsetMinutes,
            availabilityDurationMinutes: resource.availabilityDurationMinutes,
        });

        resource.activationAt = timing.activationAt;
        resource.expirationAt = timing.expirationAt;
        await this.resourceRepository.save(resource);

        assessment.deliveryDate = timing.activationAt;
        assessment.expirationDate = timing.expirationAt;
        await this.assessmentRepository.save(assessment);
    }

    private async detachAnsweredResourceAndReplace(
        session: ClinicalSession,
        occurrence: CalendarOccurrence,
        resource: ClinicalSessionResource,
        assessment: Assessment,
    ): Promise<ClinicalSessionResource> {
        resource.status = ClinicalSessionResourceStatus.DETACHED;
        resource.detachedAt = new Date();
        resource.detachedReason = 'SESSION_RESCHEDULED_AFTER_ASSESSMENT_ANSWERED';
        await this.resourceRepository.save(resource);

        assessment.clinicalSessionId = null;
        assessment.clinicalSessionResourceId = null;
        assessment.detachedFromSessionAt = resource.detachedAt;
        assessment.detachedFromSessionReason = resource.detachedReason;
        await this.assessmentRepository.save(assessment);

        const replacementInput = await this.buildReplacementInput(resource, assessment);
        return this.createResourceForSession(
            session,
            occurrence,
            replacementInput,
            {
                title: occurrence.title,
                sessionKind: session.sessionKind,
                startAt: occurrence.startAt,
                endAt: occurrence.endAt,
                timezone: occurrence.timezone,
                schemeId: occurrence.schemeId,
                schemeIds: occurrence.schemeId ? [occurrence.schemeId] : undefined,
                schemeAssignmentId: occurrence.schemeAssignmentId,
                sessionTemplateId: session.sessionTemplateId,
                sessionNumber: session.sessionNumber,
                patientId: session.patientId,
                targetUserId: assessment.targetUserId,
                therapistId: session.therapistId,
                supervisorId: session.supervisorId,
            },
            undefined,
            resource.id,
        );
    }

    private normalizeSchemeIds(input: CreateClinicalSessionInput): void {
        const schemeIds = this.schemeIds(input);
        if (!input.schemeId && schemeIds.length) {
            input.schemeId = schemeIds[0];
        }
    }

    private schemeIds(input: CreateClinicalSessionInput): number[] {
        return [...new Set([...(input.schemeIds || []), input.schemeId].filter((id): id is number => !!id))];
    }

    private primarySchemeId(input: CreateClinicalSessionInput): number | undefined {
        return this.schemeIds(input)[0];
    }

    private async createLinkedAssessment(
        session: ClinicalSession,
        occurrence: CalendarOccurrence,
        resource: ClinicalSessionResource,
        resourceInput: CreateClinicalSessionResourceInput,
        sessionInput: CreateClinicalSessionInput,
        currentUser?: User,
    ): Promise<Assessment | null> {
        if (!this.isAssessmentResource(resourceInput.resourceKind)) return null;

        if (!resourceInput.assessmentTypeId) {
            throw new BadRequestException('Assessment resource requires assessmentTypeId');
        }

        if (!resourceInput.responderUserId) {
            throw new BadRequestException('Assessment resource requires responderUserId');
        }

        const assessment = await this.assessmentService.createNewAssessment(
            ({
                assessmentTypeId: resourceInput.assessmentTypeId,
                patientId: sessionInput.patientId,
                targetUserId: sessionInput.targetUserId,
                responderUserId: resourceInput.responderUserId,
                clinicianId:
                    resourceInput.clinicianId ||
                    sessionInput.therapistId ||
                    currentUser?.id,
                mailTemplateId: resourceInput.mailTemplateId,
                informantType:
                    resourceInput.informantType || defaultInformantType,
                note: resourceInput.note,
                questionnaires: resourceInput.questionnaires || [],
                questionnaireBundles: resourceInput.questionnaireBundles || [],
                dates: [
                    {
                        deliveryDate: resource.activationAt,
                        expirationDate: resource.expirationAt,
                        reminderMinutes: resource.reminderMinutes || [],
                    },
                ],
                emailReminder: resourceInput.emailReminder || false,
                receiverEmail: resourceInput.receiverEmail,
            } as unknown) as CreateFullAssessmentInput,
            currentUser,
        );

        assessment.calendarOccurrenceId = occurrence.id;
        assessment.clinicalSessionId = session.id;
        assessment.clinicalSessionResourceId = resource.id;
        assessment.schemeId = occurrence.schemeId;
        assessment.schemeAssignmentId = occurrence.schemeAssignmentId;
        assessment.schemeResourceTemplateId = resourceInput.resourceTemplateId;
        await this.assessmentRepository.save(assessment);

        return assessment;
    }

    private async buildReplacementInput(
        resource: ClinicalSessionResource,
        assessment: Assessment,
    ): Promise<CreateClinicalSessionResourceInput> {
        const questionnaireAssessment = await this.assessmentService.getQuestionnaireAssessment(
            assessment.questionnaireAssessmentId,
        );

        return {
            resourceKind: resource.resourceKind,
            resourceTemplateId: resource.resourceTemplateId,
            activationAnchor: resource.activationAnchor,
            activationOffsetMinutes: resource.activationOffsetMinutes,
            availabilityDurationMinutes: resource.availabilityDurationMinutes,
            reminderMinutes: resource.reminderMinutes || [],
            assessmentTypeId: assessment.assessmentTypeId,
            questionnaires: ((questionnaireAssessment.questionnaires || []) as any[]).map(
                questionnaire =>
                    questionnaire._id?.toString?.() || questionnaire.toString(),
            ),
            questionnaireBundles: ((questionnaireAssessment.questionnaireBundles || []) as any[]).map(
                bundle => bundle._id?.toString?.() || bundle.toString(),
            ),
            responderUserId: assessment.responderUserId,
            clinicianId: assessment.clinicianId,
            informantType: assessment.informantType,
            note: assessment.note,
            emailReminder: assessment.emailReminder,
            receiverEmail: assessment.receiverEmail,
            mailTemplateId: assessment.mailTemplateId,
        };
    }

    private resolveResourceTiming(
        sessionStartAt: Date,
        sessionEndAt: Date,
        resourceInput: Pick<
            CreateClinicalSessionResourceInput,
            | 'resourceKind'
            | 'activationAnchor'
            | 'activationOffsetMinutes'
            | 'availabilityDurationMinutes'
        >,
    ) {
        if (
            resourceInput.activationAnchor &&
            resourceInput.activationOffsetMinutes !== undefined &&
            resourceInput.availabilityDurationMinutes !== undefined
        ) {
            return this.timingService.calculateResourceWindow({
                sessionStartAt,
                sessionEndAt,
                activationAnchor: resourceInput.activationAnchor,
                activationOffsetMinutes: resourceInput.activationOffsetMinutes,
                availabilityDurationMinutes:
                    resourceInput.availabilityDurationMinutes,
            });
        }

        if (resourceInput.resourceKind === ClinicalSessionResourceKind.POST_ASSESSMENT) {
            return this.timingService.getDefaultPostAssessmentWindow(
                sessionStartAt,
                sessionEndAt,
            );
        }

        if (resourceInput.resourceKind === ClinicalSessionResourceKind.PRE_ASSESSMENT) {
            return this.timingService.getDefaultPreAssessmentWindow(
                sessionStartAt,
                sessionEndAt,
            );
        }

        return this.timingService.calculateResourceWindow({
            sessionStartAt,
            sessionEndAt,
            activationAnchor: ResourceActivationAnchor.SESSION_START,
            activationOffsetMinutes: 0,
            availabilityDurationMinutes: Math.max(
                0,
                Math.floor(
                    (sessionEndAt.getTime() - sessionStartAt.getTime()) /
                        60000,
                ),
            ),
        });
    }

    private isAssessmentResource(kind: ClinicalSessionResourceKind): boolean {
        return [
            ClinicalSessionResourceKind.PRE_ASSESSMENT,
            ClinicalSessionResourceKind.POST_ASSESSMENT,
        ].includes(kind);
    }

    private isAssessmentAnswered(assessment: Assessment): boolean {
        return (
            !!assessment.submissionDate ||
            [
                AssessmentStatus.COMPLETED,
                AssessmentStatus.PARTIALLY_COMPLETED,
            ].includes(assessment.status as AssessmentStatus)
        );
    }

    private validateSessionWindow(startAt: Date, endAt: Date): void {
        if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
            throw new BadRequestException('Session endAt must be after startAt');
        }
    }

    private async cleanupFailedSessionCreate(
        clinicalSessionId: number,
        occurrenceId: number,
    ): Promise<void> {
        const resources = await this.resourceRepository.find({
            where: { clinicalSessionId },
        });
        const assessmentIds = resources
            .map(resource => resource.assessmentId)
            .filter((assessmentId): assessmentId is number => !!assessmentId);

        if (assessmentIds.length) {
            await this.resourceRepository.update(
                { clinicalSessionId },
                { assessmentId: null },
            );
            await this.assessmentRepository.update(
                assessmentIds,
                {
                    calendarOccurrenceId: null,
                    clinicalSessionId: null,
                    clinicalSessionResourceId: null,
                },
            );
        }

        await this.resourceRepository.delete({ clinicalSessionId });

        if (assessmentIds.length) {
            for (const assessmentId of assessmentIds) {
                await this.assessmentService.deleteAssessment(assessmentId, false);
            }
        }

        await this.clinicalSessionRepository.delete(clinicalSessionId);
        await this.occurrenceRepository.delete(occurrenceId);
    }
}
