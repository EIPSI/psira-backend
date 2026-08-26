import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
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
import { EvaluationAutomationTriggerPoint } from 'src/modules/evaluation-automation/enums/evaluation-automation-trigger-point.enum';
import { Patient } from 'src/modules/patient/models/patient.model';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { AssessmentStatus } from 'src/modules/questionnaire/enums/assessment-status.enum';
import { TreatmentCycleKind } from 'src/modules/treatment-cycle/enums/treatment-cycle-kind.enum';
import { TreatmentCycleStatus } from 'src/modules/treatment-cycle/enums/treatment-cycle-status.enum';
import { CaseEventReasonContext } from 'src/modules/treatment-cycle/enums/case-event-reason-context.enum';
import { TreatmentCycle } from 'src/modules/treatment-cycle/models/treatment-cycle.model';
import { User } from 'src/modules/user/models/user.model';
import { getManager, In, Repository } from 'typeorm';
import {
    AddClinicalSessionSchemesInput,
    CancelClinicalSessionInput,
    CreateClinicalSessionInput,
    CreateClinicalSessionResourceInput,
    ClinicalSessionListFilterInput,
    defaultInformantType,
    DiscardClinicalSessionAssessmentInput,
    MoveClinicalSessionInput,
    RestructureClinicalSessionsInput,
    StopClinicalSessionSchemeInput,
    UpdateClinicalSessionFollowUpSettingsInput,
    UpdateClinicalSessionResourceInput,
    UpdateClinicalSessionInput,
} from '../dtos/clinical-session.input';
import { ClinicalSessionResourceKind } from '../enums/clinical-session-resource-kind.enum';
import { ClinicalSessionResourceStatus } from '../enums/clinical-session-resource-status.enum';
import { ClinicalSessionCancellationLabel } from '../enums/clinical-session-cancellation-label.enum';
import { ClinicalSessionCancellationType } from '../enums/clinical-session-cancellation-type.enum';
import { ClinicalSessionKind } from '../enums/clinical-session-kind.enum';
import { ClinicalSessionModality } from '../enums/clinical-session-modality.enum';
import { ClinicalSessionSchemeApplicationMode } from '../enums/clinical-session-scheme-application-mode.enum';
import { ClinicalSessionSchemeApplicationStatus } from '../enums/clinical-session-scheme-application-status.enum';
import {
    ClinicalSessionRepeatEndMode,
    ClinicalSessionRepeatUnit,
} from '../enums/clinical-session-repeat.enum';
import { ClinicalSessionStatus } from '../enums/clinical-session-status.enum';
import { ClinicalSessionResource } from '../models/clinical-session-resource.model';
import { ClinicalSessionFollowUpSetting } from '../models/clinical-session-follow-up-setting.model';
import { ClinicalSessionFollowUpVersion } from '../models/clinical-session-follow-up-version.model';
import { ClinicalSessionSchemeApplication } from '../models/clinical-session-scheme-application.model';
import { ClinicalSession } from '../models/clinical-session.model';
import { ClinicalSessionCancellationReasonService } from './clinical-session-cancellation-reason.service';
import { ClinicalSessionTimingService } from './clinical-session-timing.service';

@Injectable()
export class ClinicalSessionSchedulingService {
    private readonly logger = new Logger('ClinicalSessionSchedulingService');

    constructor(
        @InjectRepository(CalendarOccurrence)
        private readonly occurrenceRepository: Repository<CalendarOccurrence>,
        @InjectRepository(ClinicalSession)
        private readonly clinicalSessionRepository: Repository<ClinicalSession>,
        @InjectRepository(ClinicalSessionResource)
        private readonly resourceRepository: Repository<ClinicalSessionResource>,
        @InjectRepository(ClinicalSessionFollowUpSetting)
        private readonly followUpSettingRepository: Repository<ClinicalSessionFollowUpSetting>,
        @InjectRepository(ClinicalSessionFollowUpVersion)
        private readonly followUpVersionRepository: Repository<ClinicalSessionFollowUpVersion>,
        @InjectRepository(ClinicalSessionSchemeApplication)
        private readonly schemeApplicationRepository: Repository<ClinicalSessionSchemeApplication>,
        @InjectRepository(TreatmentCycle)
        private readonly treatmentCycleRepository: Repository<TreatmentCycle>,
        @InjectRepository(SchemeSessionTemplate)
        private readonly sessionTemplateRepository: Repository<SchemeSessionTemplate>,
        @InjectRepository(SchemeResourceTemplate)
        private readonly schemeResourceTemplateRepository: Repository<SchemeResourceTemplate>,
        @InjectRepository(Patient)
        private readonly patientRepository: Repository<Patient>,
        @InjectRepository(Assessment)
        private readonly assessmentRepository: Repository<Assessment>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly assessmentService: AssessmentService,
        private readonly cancellationReasonService: ClinicalSessionCancellationReasonService,
        private readonly calendarOccurrenceService: CalendarOccurrenceService,
        private readonly googleCalendarSyncService: GoogleCalendarSyncService,
        private readonly timingService: ClinicalSessionTimingService,
        private readonly moduleRef: ModuleRef,
    ) {}

    async createClinicalSession(
        input: CreateClinicalSessionInput,
        currentUser?: User,
    ): Promise<ClinicalSession> {
        this.validateSessionWindow(input.startAt, input.endAt);
        this.normalizeSchemeIds(input);
        const responsibleUserIds = this.resolveSessionResponsibleUserIds(input, currentUser);
        this.syncLegacyResponsibleFields(input, responsibleUserIds);
        await this.assertCanAssignSessionResponsibles(input, responsibleUserIds, currentUser);
        await this.resolveSchemeSessionNumber(input);
        const treatmentCycleId =
            input.treatmentCycleId || await this.resolveActiveTreatmentCycleId(input);
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
                treatmentCycleId,
                modality: input.modality || ClinicalSessionModality.IN_PERSON,
                clinicalStatus: ClinicalSessionStatus.SCHEDULED,
            }),
        );
        session.calendarOccurrence = occurrence;
        await this.setSessionResponsibleUsers(session, occurrence, responsibleUserIds);

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

        await this.normalizeSessionNumbersForSession(session);
        await this.syncActiveSchemeResourcesFrom(session, currentUser);
        await this.googleCalendarSyncService.syncOccurrence(occurrence.id);

        const savedSession = await this.clinicalSessionRepository.findOneOrFail(session.id, {
            relations: ['calendarOccurrence', 'responsibleUsers', 'resources', 'resources.assessment', 'patient'],
        });
        await this.dispatchSessionNumberAutomation(savedSession, currentUser);

        return savedSession;
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

        await this.assertCanManageSession(session, currentUser);

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

        await this.normalizeSessionNumbersForSession(session);
        await this.syncActiveSchemeResourcesFrom(session, currentUser);
        await this.googleCalendarSyncService.syncOccurrence(occurrence.id);

        const savedSession = await this.clinicalSessionRepository.findOneOrFail(session.id, {
            relations: ['calendarOccurrence', 'resources', 'resources.assessment', 'patient'],
        });
        await this.dispatchSessionNumberAutomationsForCase(savedSession, currentUser);

        return savedSession;
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
            .leftJoinAndSelect('session.responsibleUsers', 'responsibleUser')
            .leftJoinAndSelect('session.resources', 'resource')
            .leftJoinAndSelect('resource.assessment', 'assessment')
            .leftJoinAndSelect('assessment.assessmentType', 'assessmentType')
            .where('occurrence.id IS NOT NULL');

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

        if (filter.clinicalStatus) {
            query.andWhere('session."clinicalStatus" = :clinicalStatus', {
                clinicalStatus: filter.clinicalStatus,
            });
        }

        return query.orderBy('occurrence."startAt"', 'DESC').getMany();
    }

    async getClinicalSessionFollowUpVersions(
        clinicalSessionId: number,
    ): Promise<ClinicalSessionFollowUpVersion[]> {
        return this.followUpVersionRepository.find({
            where: { clinicalSessionId },
            relations: ['editedBy'],
            order: { createdAt: 'DESC' },
        });
    }

    async getClinicalSessionFollowUpSettings(): Promise<ClinicalSessionFollowUpSetting> {
        return this.getOrCreateFollowUpSettings();
    }

    async updateClinicalSessionFollowUpSettings(
        input: UpdateClinicalSessionFollowUpSettingsInput,
    ): Promise<ClinicalSessionFollowUpSetting> {
        if (input.editWindowDays < 0) {
            throw new BadRequestException('Edit window must be zero or greater');
        }
        const settings = await this.getOrCreateFollowUpSettings();
        settings.editWindowDays = input.editWindowDays;
        return this.followUpSettingRepository.save(settings);
    }

    async getActiveSchemeApplicationsForSession(
        clinicalSessionId: number,
    ): Promise<ClinicalSessionSchemeApplication[]> {
        const session = await this.clinicalSessionRepository.findOneOrFail(
            clinicalSessionId,
        );
        await this.ensureLegacySchemeApplicationsForSession(session);
        const query = this.schemeApplicationRepository
            .createQueryBuilder('application')
            .leftJoinAndSelect('application.scheme', 'scheme')
            .leftJoinAndSelect('application.startSession', 'startSession')
            .leftJoinAndSelect('application.stoppedAtSession', 'stoppedAtSession')
            .where('application."sessionKind" = :sessionKind', {
                sessionKind: session.sessionKind,
            })
            .andWhere('application.status = :status', {
                status: ClinicalSessionSchemeApplicationStatus.ACTIVE,
            })
            .orderBy('application."createdAt"', 'ASC');

        this.applySchemeApplicationContextFilter(query, session);
        return query.getMany();
    }

    private async ensureLegacySchemeApplicationsForSession(
        session: ClinicalSession,
    ): Promise<void> {
        const rows = await getManager().query(
            `
            SELECT
                assessment."schemeId" AS "schemeId",
                resource.id AS "resourceId",
                assessment.id AS "assessmentId",
                clinical_session.id AS "clinicalSessionId",
                clinical_session."sessionNumber" AS "sessionNumber",
                occurrence."startAt" AS "startAt"
            FROM clinical_session_resource resource
            INNER JOIN assessment assessment
                ON assessment.id = resource."assessmentId"
            INNER JOIN clinical_session clinical_session
                ON clinical_session.id = resource."clinicalSessionId"
            INNER JOIN calendar_occurrence occurrence
                ON occurrence.id = clinical_session."calendarOccurrenceId"
            WHERE assessment."schemeId" IS NOT NULL
                AND resource."schemeApplicationId" IS NULL
                AND resource.status NOT IN ('CANCELLED', 'DETACHED')
                AND clinical_session."clinicalStatus" != 'CANCELLED'
                AND clinical_session."sessionKind" = $1
                AND (
                    ($2::integer IS NOT NULL AND clinical_session."patientId" = $2)
                    OR ($2::integer IS NULL AND clinical_session."patientId" IS NULL AND clinical_session."therapistId" = $3)
                )
            ORDER BY assessment."schemeId", occurrence."startAt", clinical_session.id
            `,
            [
                session.sessionKind,
                session.patientId || null,
                session.patientId ? null : session.therapistId,
            ],
        );

        const rowsByScheme = new Map<number, any[]>();
        for (const row of rows) {
            const schemeId = Number(row.schemeId);
            if (!Number.isFinite(schemeId)) continue;
            rowsByScheme.set(schemeId, [...(rowsByScheme.get(schemeId) || []), row]);
        }

        for (const [schemeId, schemeRows] of rowsByScheme.entries()) {
            const existingApplication = await this.findActiveSchemeApplication(
                session,
                schemeId,
            );
            const application = existingApplication || await this.createSchemeApplication(
                {
                    ...session,
                    id: Number(schemeRows[0].clinicalSessionId),
                    sessionNumber: Number(schemeRows[0].sessionNumber) || session.sessionNumber,
                } as ClinicalSession,
                schemeId,
                ClinicalSessionSchemeApplicationMode.ORIGINAL_SESSION_NUMBER,
                undefined,
            );
            const resourceIds = schemeRows.map(row => Number(row.resourceId)).filter(id => Number.isFinite(id));
            const assessmentIds = schemeRows.map(row => Number(row.assessmentId)).filter(id => Number.isFinite(id));
            if (resourceIds.length) {
                await this.resourceRepository.update(
                    { id: In(resourceIds) },
                    { schemeApplicationId: application.id },
                );
            }
            if (assessmentIds.length) {
                await this.assessmentRepository.update(
                    { id: In(assessmentIds) },
                    { schemeApplicationId: application.id },
                );
            }
        }
    }

    async updateClinicalSession(
        input: UpdateClinicalSessionInput,
        currentUser?: User,
    ): Promise<ClinicalSession> {
        let session = await this.clinicalSessionRepository.findOneOrFail(
            input.clinicalSessionId,
            {
                relations: ['calendarOccurrence', 'responsibleUsers', 'resources', 'resources.assessment'],
            },
        );

        await this.assertCanManageSession(session, currentUser);

        if (input.startAt || input.endAt) {
            const startAt = input.startAt || session.calendarOccurrence.startAt;
            const endAt = input.endAt || session.calendarOccurrence.endAt;
            await this.moveClinicalSession({
                clinicalSessionId: session.id,
                startAt,
                endAt,
            }, currentUser);
            session = await this.clinicalSessionRepository.findOneOrFail(session.id, {
                relations: ['calendarOccurrence', 'responsibleUsers', 'resources', 'resources.assessment'],
            });
        }

        if (input.clinicalHistory !== undefined) {
            if ((session.clinicalHistory || '') !== (input.clinicalHistory || '')) {
                await this.assertFollowUpCanBeEdited(session, currentUser);
                await this.followUpVersionRepository.save(
                    this.followUpVersionRepository.create({
                        clinicalSessionId: session.id,
                        previousText: session.clinicalHistory,
                        nextText: input.clinicalHistory,
                        editedByUserId: currentUser?.id,
                    }),
                );
            }
            session.clinicalHistory = input.clinicalHistory;
            await this.clinicalSessionRepository.save(session);
        }

        if (input.sessionNumber !== undefined) {
            await this.updateSessionNumber(session, input.sessionNumber);
        }

        if (input.responsibleUserIds !== undefined) {
            const responsibleUserIds = this.resolveSessionResponsibleUserIds({
                sessionKind: session.sessionKind,
                therapistId: session.therapistId,
                supervisorId: session.supervisorId,
                responsibleUserIds: input.responsibleUserIds,
            });
            if (!responsibleUserIds.length) {
                throw new BadRequestException('At least one responsible user is required');
            }
            await this.assertCanAssignSessionResponsibles(
                {
                    sessionKind: session.sessionKind,
                    patientId: session.patientId,
                    therapistId: session.therapistId,
                    supervisorId: session.supervisorId,
                    responsibleUserIds,
                } as CreateClinicalSessionInput,
                responsibleUserIds,
                currentUser,
            );
            await this.setSessionResponsibleUsers(
                session,
                session.calendarOccurrence,
                responsibleUserIds,
            );
            session = await this.clinicalSessionRepository.findOneOrFail(session.id, {
                relations: ['calendarOccurrence', 'responsibleUsers', 'resources', 'resources.assessment'],
            });
        }

        if (input.modality !== undefined) {
            await this.updateSessionModalityFrom(session, input.modality);
        }

        const savedSession = await this.clinicalSessionRepository.findOneOrFail(session.id, {
            relations: [
                'calendarOccurrence',
                'patient',
                'therapist',
                'supervisor',
                'responsibleUsers',
                'resources',
                'resources.assessment',
                'resources.assessment.assessmentType',
            ],
        });
        if (input.startAt || input.endAt || input.sessionNumber !== undefined) {
            await this.dispatchSessionNumberAutomationsForCase(savedSession, currentUser);
        }
        return savedSession;
    }

    async updateClinicalSessionResource(
        input: UpdateClinicalSessionResourceInput,
        currentUser?: User,
    ): Promise<ClinicalSessionResource> {
        const resource = await this.resourceRepository.findOneOrFail(input.resourceId, {
            relations: [
                'clinicalSession',
                'clinicalSession.calendarOccurrence',
                'assessment',
                'assessment.assessmentType',
            ],
        });

        await this.assertCanManageSession(resource.clinicalSession, currentUser);

        if (resource.assessment && this.isAssessmentAnswered(resource.assessment)) {
            throw new BadRequestException(
                'Answered session assessments cannot be rescheduled from the session resource editor',
            );
        }

        if (input.resourceKind !== undefined) {
            resource.resourceKind = input.resourceKind;
        }
        if (input.status !== undefined) {
            resource.status = input.status;
        }
        if (input.activationAnchor !== undefined) {
            resource.activationAnchor = input.activationAnchor;
        }
        if (input.activationOffsetMinutes !== undefined) {
            resource.activationOffsetMinutes = input.activationOffsetMinutes;
        }
        if (input.availabilityDurationMinutes !== undefined) {
            resource.availabilityDurationMinutes = input.availabilityDurationMinutes;
        }
        if (input.reminderMinutes !== undefined) {
            resource.reminderMinutes = input.reminderMinutes;
        }

        const receivedExplicitDates =
            input.activationAt !== undefined || input.expirationAt !== undefined;
        const receivedTimingRule =
            input.activationAnchor !== undefined ||
            input.activationOffsetMinutes !== undefined ||
            input.availabilityDurationMinutes !== undefined ||
            input.resourceKind !== undefined;

        if (receivedExplicitDates) {
            resource.activationAt = input.activationAt || resource.activationAt;
            resource.expirationAt = input.expirationAt || resource.expirationAt;
        } else if (receivedTimingRule) {
            const occurrence = resource.clinicalSession.calendarOccurrence;
            const timing = this.resolveResourceTiming(occurrence.startAt, occurrence.endAt, {
                resourceKind: resource.resourceKind,
                activationAnchor: resource.activationAnchor,
                activationOffsetMinutes: resource.activationOffsetMinutes,
                availabilityDurationMinutes: resource.availabilityDurationMinutes,
            });
            resource.activationAt = timing.activationAt;
            resource.expirationAt = timing.expirationAt;
        }

        if (
            resource.activationAt &&
            resource.expirationAt &&
            new Date(resource.expirationAt).getTime() <=
                new Date(resource.activationAt).getTime()
        ) {
            throw new BadRequestException('Resource expirationAt must be after activationAt');
        }

        const savedResource = await this.resourceRepository.save(resource);

        if (
            savedResource.assessment &&
            ![
                ClinicalSessionResourceStatus.DETACHED,
                ClinicalSessionResourceStatus.CANCELLED,
            ].includes(savedResource.status)
        ) {
            savedResource.assessment.deliveryDate = savedResource.activationAt;
            savedResource.assessment.expirationDate = savedResource.expirationAt;
            savedResource.assessment.reminderMinutes =
                savedResource.reminderMinutes || [];
            await this.assessmentRepository.save(savedResource.assessment);
        }

        return this.resourceRepository.findOneOrFail(savedResource.id, {
            relations: ['assessment', 'assessment.assessmentType'],
        });
    }

    async addClinicalSessionSchemes(
        input: AddClinicalSessionSchemesInput,
        currentUser?: User,
    ): Promise<ClinicalSessionResource[]> {
        const schemeIds = this.uniqueIds(input.schemeIds || []);
        if (!schemeIds.length) {
            throw new BadRequestException('At least one evaluation scheme is required');
        }

        const referenceSession = await this.clinicalSessionRepository.findOneOrFail(
            input.clinicalSessionId,
            {
                relations: [
                    'calendarOccurrence',
                    'patient',
                    'responsibleUsers',
                    'resources',
                    'resources.assessment',
                ],
            },
        );

        await this.assertCanManageSession(referenceSession, currentUser);

        const applications = new Map<number, ClinicalSessionSchemeApplication>();
        for (const schemeId of schemeIds) {
            const existingApplication = await this.findActiveSchemeApplication(
                referenceSession,
                schemeId,
            );
            if (existingApplication && !input.overwriteExisting) {
                throw new BadRequestException(
                    'This evaluation scheme is already active for this session context',
                );
            }
            if (existingApplication) {
                await this.stopSchemeApplication(
                    existingApplication,
                    referenceSession,
                    ClinicalSessionSchemeApplicationStatus.REPLACED,
                );
                await this.cancelPendingResourcesForApplication(
                    existingApplication.id,
                    referenceSession,
                );
            }
            applications.set(
                schemeId,
                await this.createSchemeApplication(
                    referenceSession,
                    schemeId,
                    input.applicationMode || ClinicalSessionSchemeApplicationMode.RELATIVE_FROM_SESSION,
                    currentUser,
                ),
            );
        }

        const sessions = input.propagateFuture
            ? await this.futureSessionsFrom(referenceSession, true)
            : [referenceSession];
        const createdResources: ClinicalSessionResource[] = [];

        for (const [index, session] of sessions.entries()) {
            const schemeSessionNumber =
                input.applicationMode === ClinicalSessionSchemeApplicationMode.ORIGINAL_SESSION_NUMBER
                    ? session.sessionNumber
                    : index + 1;
            createdResources.push(
                ...await this.addSchemeResourcesToSession(
                    session,
                    schemeIds,
                    currentUser,
                    schemeSessionNumber,
                    applications,
                ),
            );
        }

        const createdResourceIds = createdResources.map(resource => resource.id);
        if (!createdResourceIds.length) return [];

        return this.resourceRepository.find({
            where: { id: In(createdResourceIds) },
            relations: ['assessment', 'assessment.assessmentType'],
        });
    }

    async discardClinicalSessionAssessment(
        input: DiscardClinicalSessionAssessmentInput,
        currentUser?: User,
    ): Promise<ClinicalSessionResource> {
        const resource = await this.resourceRepository.findOneOrFail({
            where: { assessmentId: input.assessmentId },
            relations: [
                'clinicalSession',
                'clinicalSession.calendarOccurrence',
                'clinicalSession.responsibleUsers',
                'assessment',
                'assessment.assessmentType',
            ],
        });

        await this.assertCanManageSession(resource.clinicalSession, currentUser, {
            allowCancelled: true,
        });

        if (!resource.assessment) {
            throw new BadRequestException('Session assessment was not found');
        }
        if (this.isAssessmentAnswered(resource.assessment)) {
            throw new BadRequestException('Answered session assessments cannot be discarded individually');
        }

        resource.status = ClinicalSessionResourceStatus.CANCELLED;
        await this.resourceRepository.save(resource);
        await this.assessmentService.deleteAssessment(resource.assessment.id, true);

        return this.resourceRepository.findOneOrFail(resource.id, {
            relations: ['assessment', 'assessment.assessmentType'],
        });
    }

    async stopClinicalSessionScheme(
        input: StopClinicalSessionSchemeInput,
        currentUser?: User,
    ): Promise<ClinicalSessionSchemeApplication> {
        const referenceSession = await this.clinicalSessionRepository.findOneOrFail(
            input.clinicalSessionId,
            {
                relations: ['calendarOccurrence', 'patient', 'responsibleUsers'],
            },
        );
        await this.assertCanManageSession(referenceSession, currentUser);
        return this.stopActiveSchemeApplication(
            referenceSession,
            input.schemeId,
            currentUser,
            ClinicalSessionSchemeApplicationStatus.STOPPED,
        );
    }

    private async findActiveSchemeApplication(
        referenceSession: ClinicalSession,
        schemeId: number,
    ): Promise<ClinicalSessionSchemeApplication | undefined> {
        const query = this.schemeApplicationRepository
            .createQueryBuilder('application')
            .leftJoinAndSelect('application.scheme', 'scheme')
            .leftJoinAndSelect('application.startSession', 'startSession')
            .leftJoinAndSelect('application.stoppedAtSession', 'stoppedAtSession')
            .where('application."schemeId" = :schemeId', { schemeId })
            .andWhere('application."sessionKind" = :sessionKind', {
                sessionKind: referenceSession.sessionKind,
            })
            .andWhere('application.status = :status', {
                status: ClinicalSessionSchemeApplicationStatus.ACTIVE,
            });

        this.applySchemeApplicationContextFilter(query, referenceSession);
        return query.getOne();
    }

    private applySchemeApplicationContextFilter(
        query: any,
        session: ClinicalSession,
    ): void {
        if (session.patientId) {
            query
                .andWhere('application."patientId" = :patientId', {
                    patientId: session.patientId,
                })
                .andWhere('application."therapistId" IS NULL');
            return;
        }

        query
            .andWhere('application."patientId" IS NULL')
            .andWhere('application."therapistId" = :therapistId', {
                therapistId: session.therapistId,
            });
    }

    private async createSchemeApplication(
        referenceSession: ClinicalSession,
        schemeId: number,
        applicationMode: ClinicalSessionSchemeApplicationMode,
        currentUser?: User,
    ): Promise<ClinicalSessionSchemeApplication> {
        return this.schemeApplicationRepository.save(
            this.schemeApplicationRepository.create({
                schemeId,
                sessionKind: referenceSession.sessionKind,
                patientId: referenceSession.patientId,
                therapistId: referenceSession.patientId ? null : referenceSession.therapistId,
                startClinicalSessionId: referenceSession.id,
                startSessionNumber: referenceSession.sessionNumber,
                applicationMode,
                status: ClinicalSessionSchemeApplicationStatus.ACTIVE,
                createdByUserId: currentUser?.id,
            }),
        );
    }

    private async stopActiveSchemeApplication(
        referenceSession: ClinicalSession,
        schemeId: number,
        currentUser: User | undefined,
        status: ClinicalSessionSchemeApplicationStatus,
    ): Promise<ClinicalSessionSchemeApplication> {
        const application = await this.findActiveSchemeApplication(referenceSession, schemeId);
        if (!application) {
            throw new BadRequestException('This evaluation scheme is not active for this session context');
        }
        await this.assertCanManageSession(referenceSession, currentUser);
        await this.stopSchemeApplication(application, referenceSession, status);
        await this.cancelPendingResourcesForApplication(application.id, referenceSession);
        return this.schemeApplicationRepository.findOneOrFail(application.id, {
            relations: ['scheme', 'startSession', 'stoppedAtSession'],
        });
    }

    private async stopSchemeApplication(
        application: ClinicalSessionSchemeApplication,
        referenceSession: ClinicalSession,
        status: ClinicalSessionSchemeApplicationStatus,
    ): Promise<void> {
        await this.schemeApplicationRepository.update(application.id, {
            status,
            stoppedAtClinicalSessionId: referenceSession.id,
        });
    }

    private async cancelPendingResourcesForApplication(
        schemeApplicationId: number,
        referenceSession: ClinicalSession,
    ): Promise<void> {
        const occurrence = referenceSession.calendarOccurrence ||
            await this.occurrenceRepository.findOne(referenceSession.calendarOccurrenceId);
        if (!occurrence) return;

        const resources = await this.resourceRepository.find({
            where: { schemeApplicationId },
            relations: [
                'assessment',
                'clinicalSession',
                'clinicalSession.calendarOccurrence',
            ],
        });

        for (const resource of resources) {
            const resourceStartAt = resource.clinicalSession?.calendarOccurrence?.startAt;
            if (!resourceStartAt) continue;
            if (new Date(resourceStartAt).getTime() < new Date(occurrence.startAt).getTime()) continue;
            if (this.resourceProtectedFromRenumber(resource)) continue;
            await this.cancelPendingResourceAfterRenumber(resource);
        }
    }

    async restructureClinicalSessions(
        input: RestructureClinicalSessionsInput,
        currentUser?: User,
    ): Promise<ClinicalSession[]> {
        const referenceSession = await this.clinicalSessionRepository.findOneOrFail(
            input.clinicalSessionId,
            {
                relations: [
                    'calendarOccurrence',
                    'responsibleUsers',
                    'patient',
                    'resources',
                    'resources.assessment',
                ],
            },
        );
        await this.assertCanManageSession(referenceSession, currentUser);
        this.validateSessionWindow(input.startAt, input.endAt);

        const futureSessions = await this.futureSessionsFrom(referenceSession, true);
        for (const session of futureSessions) {
            if (session.id === referenceSession.id) continue;
            if (this.sessionProtectedFromRestructure(session)) continue;
            await this.cancelSessionForRestructure(session);
        }

        const windows = this.buildRestructureWindows(input);
        if (!windows.length) return [];

        await this.moveClinicalSession({
            clinicalSessionId: referenceSession.id,
            startAt: windows[0].startAt,
            endAt: windows[0].endAt,
        }, currentUser);

        const baseSession = await this.clinicalSessionRepository.findOneOrFail(referenceSession.id, {
            relations: ['calendarOccurrence', 'responsibleUsers', 'patient'],
        });
        const createdSessions: ClinicalSession[] = [baseSession];

        for (const window of windows.slice(1)) {
            const sessionInput = this.buildSessionInputForFutureClone(
                baseSession,
                window.startAt,
                window.endAt,
            );
            createdSessions.push(await this.createClinicalSession(sessionInput, currentUser));
        }

        await this.normalizeSessionNumbersForSession(baseSession);
        const normalizedBaseSession = await this.clinicalSessionRepository.findOneOrFail(baseSession.id, {
            relations: ['calendarOccurrence', 'responsibleUsers', 'patient'],
        });
        await this.syncActiveSchemeResourcesFrom(normalizedBaseSession, currentUser);
        return this.getClinicalSessions({
            patientId: baseSession.patientId,
            therapistId: baseSession.patientId ? undefined : baseSession.therapistId,
            sessionKind: baseSession.sessionKind,
        });
    }

    async cancelClinicalSession(
        input: CancelClinicalSessionInput,
        currentUser?: User,
    ): Promise<ClinicalSession> {
        const session = await this.clinicalSessionRepository.findOneOrFail(
            input.clinicalSessionId,
            {
                relations: [
                    'calendarOccurrence',
                    'responsibleUsers',
                    'resources',
                    'resources.assessment',
                ],
            },
        );

        await this.assertCanManageSession(session, currentUser);

        const cancellationType = input.cancellationType || ClinicalSessionCancellationType.RESCHEDULED;
        const cancellationLabel = cancellationType === ClinicalSessionCancellationType.NO_SHOW
            ? ClinicalSessionCancellationLabel.CANCELLED
            : ClinicalSessionCancellationLabel.RESCHEDULED;
        const cancellationReasonSnapshot = this.withOtherReasonDetail(
            await this.resolveCancellationReasonSnapshot(input),
            input.cancellationOtherReason,
        );

        session.cancelledAt = new Date();
        session.cancelledSessionNumber = session.sessionNumber;
        session.cancelledStartAt = session.calendarOccurrence.startAt;
        session.cancellationType = cancellationType;
        session.cancellationLabel = cancellationLabel;
        session.cancellationReasonId = input.cancellationReasonId;
        session.cancellationReasonSnapshot = cancellationReasonSnapshot || input.cancellationReason;
        session.cancellationComment = input.cancellationComment;
        session.clinicalStatus = ClinicalSessionStatus.CANCELLED;
        session.sessionNumber = null;
        await this.clinicalSessionRepository.save(session);

        session.calendarOccurrence.status = CalendarOccurrenceStatus.CANCELLED;
        session.calendarOccurrence.cancellationReason =
            session.cancellationReasonSnapshot || input.cancellationReason;
        await this.occurrenceRepository.save(session.calendarOccurrence);

        for (const resource of session.resources || []) {
            await this.cancelResourceAndLinkedAssessment(resource);
        }

        await this.renumberFutureSessionsAfterCancellation(session);
        await this.normalizeSessionNumbersForSession(session);
        await this.syncActiveSchemeResourcesFrom(session, currentUser);
        await this.googleCalendarSyncService.syncOccurrence(session.calendarOccurrenceId);
        await this.dispatchSessionNumberAutomationsForCase(session, currentUser);
        await this.dispatchNoShowCancellationAutomation(session, currentUser, input);

        return this.clinicalSessionRepository.findOneOrFail(session.id, {
            relations: [
                'calendarOccurrence',
                'cancellationReasonTreeNode',
                'resources',
                'resources.assessment',
            ],
        });
    }

    private async dispatchSessionNumberAutomation(
        session: ClinicalSession,
        currentUser?: User,
    ): Promise<void> {
        const automationEngine = this.resolveAutomationEngine();
        if (!automationEngine || !session.sessionNumber) return;
        try {
            const target = await this.resolveAutomationTargetUser(session, currentUser);
            if (!target) return;
            await automationEngine.handleTrigger({
                triggerPoint: EvaluationAutomationTriggerPoint.SESSION_NUMBER,
                userId: target.id,
                patientId: session.patientId,
                therapistId: session.therapistId,
                treatmentCycleId: session.treatmentCycleId,
                clinicalSessionId: session.id,
                sessionNumber: session.sessionNumber,
                triggerOccurredAt: session.calendarOccurrence?.startAt || new Date(),
                metadata: {
                    sessionKind: session.sessionKind,
                    sessionNumber: session.sessionNumber,
                },
            });
        } catch (error) {
            this.logger.error(
                `Unable to dispatch session_number automation for session ${session.id}: ${error?.message}`,
            );
        }
    }

    private async dispatchNoShowCancellationAutomation(
        session: ClinicalSession,
        currentUser: User | undefined,
        input: CancelClinicalSessionInput,
    ): Promise<void> {
        if (
            session.cancellationType !== ClinicalSessionCancellationType.NO_SHOW
        ) {
            return;
        }
        const automationEngine = this.resolveAutomationEngine();
        if (!automationEngine) return;
        try {
            const target = await this.resolveAutomationTargetUser(session, currentUser);
            if (!target) return;
            await automationEngine.handleTrigger({
                triggerPoint: EvaluationAutomationTriggerPoint.SESSION_NO_SHOW_CANCELLATION,
                userId: target.id,
                patientId: session.patientId,
                therapistId: session.therapistId,
                treatmentCycleId: session.treatmentCycleId,
                clinicalSessionId: session.id,
                sessionNumber: session.cancelledSessionNumber,
                reasonId: session.cancellationReasonId,
                reasonContext: session.sessionKind === ClinicalSessionKind.SUPERVISION
                    ? CaseEventReasonContext.SUPERVISION_SESSION_CANCELLATION
                    : CaseEventReasonContext.SESSION_CANCELLATION,
                triggerOccurredAt: session.cancelledAt || new Date(),
                excludedAutomationIds: input.excludedAutomationIds || [],
                metadata: {
                    cancellationType: session.cancellationType,
                    cancellationReasonSnapshot: session.cancellationReasonSnapshot,
                    cancellationComment: session.cancellationComment,
                },
            });
        } catch (error) {
            this.logger.error(
                `Unable to dispatch no-show cancellation automation for session ${session.id}: ${error?.message}`,
            );
        }
    }

    private async dispatchSessionNumberAutomationsForCase(
        referenceSession: ClinicalSession,
        currentUser?: User,
    ): Promise<void> {
        const startAt = referenceSession.calendarOccurrence?.startAt ||
            referenceSession.cancelledStartAt ||
            new Date();
        const query = this.clinicalSessionRepository
            .createQueryBuilder('session')
            .leftJoinAndSelect('session.calendarOccurrence', 'occurrence')
            .leftJoinAndSelect('session.patient', 'patient')
            .where('session."sessionKind" = :sessionKind', {
                sessionKind: referenceSession.sessionKind,
            })
            .andWhere('session."clinicalStatus" != :cancelledStatus', {
                cancelledStatus: ClinicalSessionStatus.CANCELLED,
            })
            .andWhere('session."sessionNumber" IS NOT NULL')
            .andWhere('occurrence."startAt" >= :startAt', { startAt })
            .orderBy('occurrence."startAt"', 'ASC');

        if (referenceSession.treatmentCycleId) {
            query.andWhere('session."treatmentCycleId" = :treatmentCycleId', {
                treatmentCycleId: referenceSession.treatmentCycleId,
            });
        } else if (referenceSession.patientId) {
            query.andWhere('session."patientId" = :patientId', {
                patientId: referenceSession.patientId,
            });
        } else if (referenceSession.therapistId) {
            query.andWhere('session."therapistId" = :therapistId', {
                therapistId: referenceSession.therapistId,
            });
        }

        const sessions = await query.getMany();
        for (const session of sessions) {
            await this.dispatchSessionNumberAutomation(session, currentUser);
        }
    }

    private async resolveAutomationTargetUser(
        session: ClinicalSession,
        currentUser?: User,
    ): Promise<User | undefined> {
        if (session.patientId) {
            const patient = session.patient || await this.patientRepository.findOne(session.patientId);
            if (patient?.userId) {
                const patientUser = await this.userRepository.findOne(patient.userId);
                if (patientUser) return patientUser;
            }
        }
        if (session.therapistId) {
            const therapist = await this.userRepository.findOne(session.therapistId);
            if (therapist) return therapist;
        }
        return currentUser;
    }

    private resolveAutomationEngine(): any {
        try {
            return this.moduleRef.get('EVALUATION_AUTOMATION_ENGINE', { strict: false });
        } catch (error) {
            return null;
        }
    }

    private async resolveCancellationReasonSnapshot(
        input: CancelClinicalSessionInput,
    ): Promise<string | undefined> {
        if (!input.cancellationReasonId) {
            if (input.cancellationType === ClinicalSessionCancellationType.NO_SHOW) {
                throw new BadRequestException('No-show cancellations require a cancellation reason');
            }
            return input.cancellationReason;
        }

        const snapshot = await this.cancellationReasonService.reasonPathSnapshot(
            input.cancellationReasonId,
        );
        if (!snapshot) {
            throw new BadRequestException('Cancellation reason was not found');
        }
        return snapshot;
    }

    private withOtherReasonDetail(
        snapshot?: string,
        otherReason?: string,
    ): string | undefined {
        const detail = (otherReason || '').trim();
        if (!detail) return snapshot;
        return snapshot ? `${snapshot}: ${detail}` : detail;
    }

    private async cancelResourceAndLinkedAssessment(
        resource: ClinicalSessionResource,
    ): Promise<void> {
        resource.status = ClinicalSessionResourceStatus.CANCELLED;
        await this.resourceRepository.save(resource);
        if (resource.assessmentId) {
            await this.assessmentService.deleteAssessment(resource.assessmentId, true);
        }
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
                schemeApplicationId: resourceInput.schemeApplicationId,
                schemeRelativeSessionNumber: resourceInput.schemeRelativeSessionNumber,
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

    private async assertFollowUpCanBeEdited(
        session: ClinicalSession,
        currentUser?: User,
    ): Promise<void> {
        if (!session.calendarOccurrence?.startAt || !currentUser) return;
        if (await this.userHasPermission(currentUser.id, PermissionEnum.MANAGE_ALL_ASSESSMENTS)) {
            return;
        }
        const settings = await this.getOrCreateFollowUpSettings();
        const editUntil = new Date(session.calendarOccurrence.startAt);
        editUntil.setDate(editUntil.getDate() + settings.editWindowDays);
        if (new Date() > editUntil) {
            throw new BadRequestException('The follow-up edit window has expired');
        }
    }

    private async getOrCreateFollowUpSettings(): Promise<ClinicalSessionFollowUpSetting> {
        let settings = await this.followUpSettingRepository.findOne(1);
        if (!settings) {
            settings = await this.followUpSettingRepository.save(
                this.followUpSettingRepository.create({
                    id: 1,
                    editWindowDays: 7,
                }),
            );
        }
        return settings;
    }

    private async assertCanManageSession(
        session: ClinicalSession,
        currentUser?: User,
        options: { allowCancelled?: boolean } = {},
    ): Promise<void> {
        if (
            session.clinicalStatus === ClinicalSessionStatus.CANCELLED &&
            !options.allowCancelled
        ) {
            throw new BadRequestException('Cancelled sessions cannot be edited');
        }
        if (!currentUser) return;
        if (await this.canManageSessionByScope(session, currentUser)) {
            return;
        }
        if (session.patientId) {
            const caseManagerIds = await this.caseManagerIdsForPatient(session.patientId);
            if (!caseManagerIds.includes(currentUser.id)) {
                throw new BadRequestException('Only case administrators can edit this patient session');
            }
            return;
        }

        if (session.sessionKind === ClinicalSessionKind.SUPERVISION) {
            const therapistId = session.therapistId || session.calendarOccurrence?.therapistId;
            if (therapistId && !(await this.isSupervisorOfTherapist(therapistId, currentUser.id))) {
                throw new BadRequestException('Only the assigned supervisor can edit this session');
            }
            return;
        }

        const responsibleUserIds = this.uniqueIds([
            ...(session.responsibleUsers || []).map(user => user.id),
            session.therapistId,
            session.supervisorId,
        ]);
        if (responsibleUserIds.length && !responsibleUserIds.includes(currentUser.id)) {
            throw new BadRequestException('Only the assigned therapist can edit this session');
        }
    }

    private async canManageSessionByScope(
        session: ClinicalSession,
        currentUser: User,
    ): Promise<boolean> {
        if (await this.userHasPermission(currentUser.id, PermissionEnum.MANAGE_ALL_ASSESSMENTS)) {
            return true;
        }
        if (!(await this.userHasPermission(currentUser.id, PermissionEnum.MANAGE_DEPARTMENT_ASSESSMENTS))) {
            return false;
        }

        const [manager, patient, therapist] = await Promise.all([
            this.userRepository.findOne({
                where: { id: currentUser.id },
                relations: ['departments'],
            }),
            session.patientId
                ? this.patientRepository.findOne(session.patientId, { relations: ['departments'] })
                : Promise.resolve(undefined),
            session.therapistId
                ? this.userRepository.findOne({
                    where: { id: session.therapistId },
                    relations: ['departments'],
                })
                : Promise.resolve(undefined),
        ]);
        const managerDepartmentIds = manager?.departments?.map(department => department.id) || [];
        const targetDepartmentIds = patient?.departments?.map(department => department.id) ||
            therapist?.departments?.map(department => department.id) ||
            [];
        return targetDepartmentIds.some(id => managerDepartmentIds.includes(id));
    }

    private resolveSessionResponsibleUserIds(
        input: Pick<CreateClinicalSessionInput, 'responsibleUserIds' | 'therapistId' | 'supervisorId' | 'sessionKind'>,
        currentUser?: User,
    ): number[] {
        const fallbackId = input.sessionKind === ClinicalSessionKind.SUPERVISION
            ? input.supervisorId
            : input.therapistId;
        return this.uniqueIds([...(input.responsibleUserIds || []), fallbackId, currentUser?.id]);
    }

    private syncLegacyResponsibleFields(
        input: CreateClinicalSessionInput,
        responsibleUserIds: number[],
    ): void {
        const primaryResponsibleUserId = responsibleUserIds[0];
        if (!primaryResponsibleUserId) return;
        if (input.sessionKind === ClinicalSessionKind.SUPERVISION) {
            input.supervisorId = primaryResponsibleUserId;
            return;
        }
        input.therapistId = primaryResponsibleUserId;
    }

    private async setSessionResponsibleUsers(
        session: ClinicalSession,
        occurrence: CalendarOccurrence,
        responsibleUserIds: number[],
    ): Promise<void> {
        const users = responsibleUserIds.length
            ? await this.userRepository.find({ where: { id: In(responsibleUserIds) } })
            : [];
        if (users.length !== responsibleUserIds.length) {
            throw new BadRequestException('One or more responsible users were not found');
        }

        const primaryResponsibleUserId = responsibleUserIds[0];
        if (session.sessionKind === ClinicalSessionKind.SUPERVISION) {
            session.supervisorId = primaryResponsibleUserId;
            occurrence.supervisorId = primaryResponsibleUserId;
        } else {
            session.therapistId = primaryResponsibleUserId;
            occurrence.therapistId = primaryResponsibleUserId;
        }

        session.responsibleUsers = users;
        occurrence.responsibleUsers = users;
        await this.occurrenceRepository.save(occurrence);
        await this.clinicalSessionRepository.save(session);
    }

    private async assertCanAssignSessionResponsibles(
        input: Pick<CreateClinicalSessionInput, 'sessionKind' | 'patientId' | 'therapistId' | 'targetUserId'>,
        responsibleUserIds: number[],
        currentUser?: User,
    ): Promise<void> {
        if (!currentUser) return;

        if (input.patientId) {
            const caseManagerIds = await this.caseManagerIdsForPatient(input.patientId);
            if (!caseManagerIds.includes(currentUser.id)) {
                throw new BadRequestException('Only case administrators can create sessions for this patient');
            }
            const invalidResponsibleIds = responsibleUserIds.filter(id => !caseManagerIds.includes(id));
            if (invalidResponsibleIds.length) {
                throw new BadRequestException(
                    `Session responsible users must be case administrators. Invalid user IDs: ${invalidResponsibleIds.join(', ')}`,
                );
            }
            return;
        }

        if (input.sessionKind === ClinicalSessionKind.SUPERVISION) {
            const therapistId = input.therapistId || input.targetUserId;
            if (!therapistId) {
                throw new BadRequestException('Supervision sessions require a therapist');
            }
            const supervisorIds = await this.supervisorIdsForTherapist(therapistId);
            if (!supervisorIds.includes(currentUser.id)) {
                throw new BadRequestException('Only supervisors can create sessions for this therapist');
            }
            const invalidResponsibleIds = responsibleUserIds.filter(id => !supervisorIds.includes(id));
            if (invalidResponsibleIds.length) {
                throw new BadRequestException(
                    `Session responsible users must be supervisors of the therapist. Invalid user IDs: ${invalidResponsibleIds.join(', ')}`,
                );
            }
        }
    }

    private async caseManagerIdsForPatient(patientId: number): Promise<number[]> {
        const patient = await this.patientRepository.findOne(patientId, {
            relations: ['caseManagers'],
        });
        return patient?.caseManagers?.map(user => user.id) || [];
    }

    private async supervisorIdsForTherapist(therapistId: number): Promise<number[]> {
        const rows = await getManager()
            .createQueryBuilder()
            .select('"supervisorId"', 'supervisorId')
            .from('therapist_supervisor', 'therapistSupervisor')
            .where('"therapistId" = :therapistId', { therapistId })
            .getRawMany();
        return rows.map(row => Number(row.supervisorId)).filter(id => Number.isFinite(id));
    }

    private async userHasPermission(userId: number, permission: string): Promise<boolean> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ['permissions', 'roles', 'roles.permissions'],
        });
        if (!user) return false;
        return user.permissions?.some(userPermission => userPermission.name === permission) ||
            user.roles?.some(role => role.permissions?.some(rolePermission => rolePermission.name === permission));
    }

    private async isSupervisorOfTherapist(
        therapistId: number,
        supervisorId: number,
    ): Promise<boolean> {
        const supervisorIds = await this.supervisorIdsForTherapist(therapistId);
        return supervisorIds.includes(supervisorId);
    }

    private uniqueIds(ids: Array<number | undefined | null>): number[] {
        return [...new Set(
            ids
                .map(id => Number(id))
                .filter(id => Number.isFinite(id) && id > 0),
        )];
    }

    private async renumberFutureSessionsAfterCancellation(
        cancelledSession: ClinicalSession,
    ): Promise<void> {
        const cancelledSessionNumber =
            cancelledSession.sessionNumber || cancelledSession.cancelledSessionNumber;
        if (!cancelledSessionNumber) return;

        const query = this.clinicalSessionRepository
            .createQueryBuilder('session')
            .innerJoinAndSelect('session.calendarOccurrence', 'occurrence')
            .where('session."sessionNumber" > :sessionNumber', {
                sessionNumber: cancelledSessionNumber,
            })
            .andWhere('session."sessionKind" = :sessionKind', {
                sessionKind: cancelledSession.sessionKind,
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

        const futureSessions = await query.getMany();
        for (const futureSession of futureSessions) {
            const previousSessionNumber = futureSession.sessionNumber;
            futureSession.sessionNumber = futureSession.sessionNumber - 1;
            await this.clinicalSessionRepository.save(futureSession);
            await this.syncPendingResourcesAfterRenumber(
                futureSession,
                previousSessionNumber,
            );
        }
    }

    private async updateSessionNumber(
        session: ClinicalSession,
        nextSessionNumber?: number,
    ): Promise<void> {
        if (!nextSessionNumber || nextSessionNumber < 1) {
            throw new BadRequestException('Session number must be greater than zero');
        }

        const previousSessionNumber = session.sessionNumber;
        if (previousSessionNumber === nextSessionNumber) return;

        await this.assertSessionNumberCanBeAssigned(session, nextSessionNumber, previousSessionNumber);

        session.sessionNumber = nextSessionNumber;
        await this.clinicalSessionRepository.save(session);
        await this.syncPendingResourcesAfterRenumber(session, previousSessionNumber);
        if (!previousSessionNumber || nextSessionNumber > previousSessionNumber) {
            await this.renumberChronologicalSessionsAfter(session, nextSessionNumber + 1);
        }
    }

    private async assertSessionNumberCanBeAssigned(
        session: ClinicalSession,
        nextSessionNumber: number,
        previousSessionNumber?: number,
    ): Promise<void> {
        const occurrence = session.calendarOccurrence || await this.occurrenceRepository.findOne(session.calendarOccurrenceId);
        if (!occurrence) {
            throw new BadRequestException('Session occurrence not found');
        }

        const peerSessions = await this.clinicalSessionRepository
            .createQueryBuilder('session')
            .innerJoinAndSelect('session.calendarOccurrence', 'occurrence')
            .where('session.id != :sessionId', { sessionId: session.id })
            .andWhere('session."sessionKind" = :sessionKind', {
                sessionKind: session.sessionKind,
            })
            .andWhere('session."clinicalStatus" != :cancelledStatus', {
                cancelledStatus: ClinicalSessionStatus.CANCELLED,
            });

        if (session.patientId) {
            peerSessions.andWhere('session."patientId" = :patientId', {
                patientId: session.patientId,
            });
        } else {
            peerSessions.andWhere('session."patientId" IS NULL');
        }

        const sessions = await peerSessions.getMany();
        const movingForward = previousSessionNumber
            ? nextSessionNumber > previousSessionNumber
            : false;
        const existingSession = sessions.find(peerSession =>
            peerSession.sessionNumber === nextSessionNumber,
        );
        if (existingSession && !movingForward) {
            throw new BadRequestException(
                `Session number ${nextSessionNumber} is already assigned`,
            );
        }

        const sessionTime = new Date(occurrence.startAt).getTime();
        const previousSessions = sessions.filter(peerSession =>
            new Date(peerSession.calendarOccurrence.startAt).getTime() < sessionTime,
        );
        const nextSessions = sessions.filter(peerSession =>
            new Date(peerSession.calendarOccurrence.startAt).getTime() > sessionTime,
        );

        const previousMaxSessionNumber = Math.max(
            0,
            ...previousSessions
                .map(peerSession => peerSession.sessionNumber || 0)
                .filter(sessionNumber => Number.isFinite(sessionNumber)),
        );
        if (nextSessionNumber <= previousMaxSessionNumber) {
            throw new BadRequestException(
                `Session number must be greater than previous chronological sessions (${previousMaxSessionNumber})`,
            );
        }

        if (movingForward) return;

        const nextSessionNumbers = nextSessions
            .map(peerSession => peerSession.sessionNumber)
            .filter((sessionNumber): sessionNumber is number => !!sessionNumber);
        const nextMinSessionNumber = nextSessionNumbers.length
            ? Math.min(...nextSessionNumbers)
            : undefined;
        if (nextMinSessionNumber && nextSessionNumber >= nextMinSessionNumber) {
            throw new BadRequestException(
                `Session number must be lower than next chronological sessions (${nextMinSessionNumber})`,
            );
        }
    }

    private async renumberChronologicalSessionsAfter(
        referenceSession: ClinicalSession,
        nextSessionNumber: number,
    ): Promise<void> {
        const occurrence = referenceSession.calendarOccurrence ||
            await this.occurrenceRepository.findOne(referenceSession.calendarOccurrenceId);
        if (!occurrence) return;

        const query = this.clinicalSessionRepository
            .createQueryBuilder('session')
            .innerJoinAndSelect('session.calendarOccurrence', 'occurrence')
            .where('session.id != :sessionId', { sessionId: referenceSession.id })
            .andWhere('session."sessionKind" = :sessionKind', {
                sessionKind: referenceSession.sessionKind,
            })
            .andWhere('session."clinicalStatus" != :cancelledStatus', {
                cancelledStatus: ClinicalSessionStatus.CANCELLED,
            })
            .andWhere('occurrence."startAt" > :startAt', { startAt: occurrence.startAt })
            .orderBy('occurrence."startAt"', 'ASC')
            .addOrderBy('session.id', 'ASC');

        if (referenceSession.patientId) {
            query.andWhere('session."patientId" = :patientId', {
                patientId: referenceSession.patientId,
            });
        } else {
            query.andWhere('session."patientId" IS NULL');
        }

        const futureSessions = await query.getMany();
        for (const futureSession of futureSessions) {
            const previousSessionNumber = futureSession.sessionNumber;
            futureSession.sessionNumber = nextSessionNumber;
            nextSessionNumber += 1;
            if (previousSessionNumber === futureSession.sessionNumber) continue;
            await this.clinicalSessionRepository.save(futureSession);
            await this.syncPendingResourcesAfterRenumber(
                futureSession,
                previousSessionNumber,
            );
        }
    }

    private async updateSessionModalityFrom(
        referenceSession: ClinicalSession,
        modality: ClinicalSessionModality,
    ): Promise<void> {
        const sessions = await this.futureSessionsFrom(referenceSession, true);
        for (const session of sessions) {
            if (session.modality === modality) continue;
            session.modality = modality;
            await this.clinicalSessionRepository.save(session);
        }
    }

    private async futureSessionsFrom(
        referenceSession: ClinicalSession,
        includeReference = false,
    ): Promise<ClinicalSession[]> {
        const occurrence = referenceSession.calendarOccurrence ||
            await this.occurrenceRepository.findOne(referenceSession.calendarOccurrenceId);
        if (!occurrence) return [];

        const query = this.clinicalSessionRepository
            .createQueryBuilder('session')
            .innerJoinAndSelect('session.calendarOccurrence', 'occurrence')
            .leftJoinAndSelect('session.patient', 'patient')
            .leftJoinAndSelect('session.responsibleUsers', 'responsibleUser')
            .leftJoinAndSelect('session.resources', 'resource')
            .leftJoinAndSelect('resource.assessment', 'assessment')
            .where('session."sessionKind" = :sessionKind', {
                sessionKind: referenceSession.sessionKind,
            })
            .andWhere('session."clinicalStatus" != :cancelledStatus', {
                cancelledStatus: ClinicalSessionStatus.CANCELLED,
            })
            .andWhere(
                includeReference
                    ? 'occurrence."startAt" >= :startAt'
                    : 'occurrence."startAt" > :startAt',
                { startAt: occurrence.startAt },
            )
            .orderBy('occurrence."startAt"', 'ASC')
            .addOrderBy('session.id', 'ASC');

        if (referenceSession.patientId) {
            query.andWhere('session."patientId" = :patientId', {
                patientId: referenceSession.patientId,
            });
        } else {
            query.andWhere('session."patientId" IS NULL');
        }

        return query.getMany();
    }

    private sessionProtectedFromRestructure(session: ClinicalSession): boolean {
        return (session.resources || []).some(resource =>
            this.resourceProtectedFromRenumber(resource),
        );
    }

    private async cancelSessionForRestructure(session: ClinicalSession): Promise<void> {
        session.cancelledAt = new Date();
        session.cancelledSessionNumber = session.sessionNumber;
        session.cancelledStartAt = session.calendarOccurrence.startAt;
        session.cancellationType = ClinicalSessionCancellationType.RESCHEDULED;
        session.cancellationLabel = ClinicalSessionCancellationLabel.RESCHEDULED;
        session.cancellationReasonSnapshot = 'Reestructuración de programación';
        session.clinicalStatus = ClinicalSessionStatus.CANCELLED;
        session.sessionNumber = null;
        await this.clinicalSessionRepository.save(session);

        session.calendarOccurrence.status = CalendarOccurrenceStatus.CANCELLED;
        session.calendarOccurrence.cancellationReason = session.cancellationReasonSnapshot;
        await this.occurrenceRepository.save(session.calendarOccurrence);

        for (const resource of session.resources || []) {
            await this.cancelResourceAndLinkedAssessment(resource);
        }

        await this.googleCalendarSyncService.syncOccurrence(session.calendarOccurrenceId);
    }

    private buildRestructureWindows(
        input: RestructureClinicalSessionsInput,
    ): Array<{ startAt: Date; endAt: Date }> {
        if (!input.every || input.every < 1) {
            throw new BadRequestException('Repeat interval must be greater than zero');
        }
        if (
            input.endMode === ClinicalSessionRepeatEndMode.AFTER_COUNT &&
            (!input.count || input.count < 1)
        ) {
            throw new BadRequestException('Repeat count must be greater than zero');
        }
        if (
            input.endMode === ClinicalSessionRepeatEndMode.ON_DATE &&
            !input.endDate
        ) {
            throw new BadRequestException('Repeat end date is required');
        }

        const startAt = new Date(input.startAt);
        const durationMs = new Date(input.endAt).getTime() - startAt.getTime();
        const windows: Array<{ startAt: Date; endAt: Date }> = [];
        const maxWindows = input.endMode === ClinicalSessionRepeatEndMode.AFTER_COUNT
            ? input.count || 1
            : input.endMode === ClinicalSessionRepeatEndMode.ON_DATE
                ? 366
                : 24;
        const endLimit = input.endDate ? this.endOfDay(new Date(input.endDate)) : undefined;

        if (input.unit === ClinicalSessionRepeatUnit.WEEK && input.repeatOnDays?.length) {
            const repeatDays = [...new Set(input.repeatOnDays)]
                .filter(day => day >= 0 && day <= 6)
                .sort((a, b) => a - b);
            if (!repeatDays.length) {
                throw new BadRequestException('At least one valid repeat day is required');
            }

            let weekIndex = 0;
            while (windows.length < maxWindows && weekIndex < 520) {
                const weekStart = this.startOfWeek(this.addDays(startAt, weekIndex * input.every * 7));
                for (const repeatDay of repeatDays) {
                    const candidate = this.copyTime(this.addDays(weekStart, repeatDay), startAt);
                    if (candidate.getTime() < startAt.getTime()) continue;
                    if (endLimit && candidate.getTime() > endLimit.getTime()) {
                        return windows;
                    }
                    windows.push({
                        startAt: candidate,
                        endAt: new Date(candidate.getTime() + durationMs),
                    });
                    if (windows.length >= maxWindows) break;
                }
                weekIndex += 1;
            }
            return windows;
        }

        let candidate = startAt;
        while (windows.length < maxWindows) {
            if (endLimit && candidate.getTime() > endLimit.getTime()) break;
            windows.push({
                startAt: new Date(candidate),
                endAt: new Date(candidate.getTime() + durationMs),
            });
            candidate = this.addRepeatPeriod(candidate, input.every, input.unit);
        }
        return windows;
    }

    private buildSessionInputForFutureClone(
        baseSession: ClinicalSession,
        startAt: Date,
        endAt: Date,
    ): CreateClinicalSessionInput {
        return {
            title: baseSession.calendarOccurrence.title,
            sessionKind: baseSession.sessionKind,
            startAt,
            endAt,
            timezone: baseSession.calendarOccurrence.timezone,
            schemeId: baseSession.calendarOccurrence.schemeId,
            schemeIds: baseSession.calendarOccurrence.schemeId
                ? [baseSession.calendarOccurrence.schemeId]
                : undefined,
            schemeAssignmentId: baseSession.calendarOccurrence.schemeAssignmentId,
            sessionTemplateId: baseSession.sessionTemplateId,
            patientId: baseSession.patientId,
            targetUserId: baseSession.patient?.userId || baseSession.therapistId,
            therapistId: baseSession.therapistId,
            supervisorId: baseSession.supervisorId,
            responsibleUserIds: this.uniqueIds([
                ...(baseSession.responsibleUsers || []).map(user => user.id),
                baseSession.therapistId,
                baseSession.supervisorId,
            ]),
            modality: baseSession.modality || ClinicalSessionModality.IN_PERSON,
        };
    }

    private async addSchemeResourcesToSession(
        session: ClinicalSession,
        schemeIds: number[],
        currentUser?: User,
        schemeSessionNumber?: number,
        applications?: Map<number, ClinicalSessionSchemeApplication>,
    ): Promise<ClinicalSessionResource[]> {
        const occurrence = session.calendarOccurrence ||
            await this.occurrenceRepository.findOne(session.calendarOccurrenceId);
        if (!occurrence) return [];

        const patient = session.patientId
            ? session.patient || await this.patientRepository.findOne(session.patientId)
            : undefined;
        const sessionInput = {
            ...this.buildSessionInputForResourceSync(session, occurrence, patient),
            schemeId: schemeIds[0],
            schemeIds,
        };
        const desiredResourceInputs = await this.buildResourcesFromScheme(
            sessionInput,
            currentUser,
            schemeSessionNumber,
        );
        if (!desiredResourceInputs.length) return [];

        const existingResources = await this.resourceRepository.find({
            where: { clinicalSessionId: session.id },
        });
        const activeTemplateIds = existingResources
            .filter(resource => ![
                ClinicalSessionResourceStatus.CANCELLED,
                ClinicalSessionResourceStatus.DETACHED,
            ].includes(resource.status))
            .map(resource => resource.resourceTemplateId)
            .filter((id): id is number => !!id);

        const createdResources: ClinicalSessionResource[] = [];
        for (const resourceInput of desiredResourceInputs) {
            const schemeApplication = resourceInput.schemeId
                ? applications?.get(resourceInput.schemeId)
                : undefined;
            if (
                resourceInput.resourceTemplateId &&
                activeTemplateIds.includes(resourceInput.resourceTemplateId)
            ) {
                continue;
            }
            createdResources.push(
                await this.createResourceForSession(
                    session,
                    occurrence,
                    {
                        ...resourceInput,
                        schemeApplicationId: schemeApplication?.id,
                        schemeRelativeSessionNumber: schemeSessionNumber,
                    },
                    sessionInput,
                    currentUser,
                ),
            );
        }

        if (!occurrence.schemeId) {
            occurrence.schemeId = schemeIds[0];
            await this.occurrenceRepository.save(occurrence);
        }

        return createdResources;
    }

    private async resolveSchemeSessionNumber(
        input: CreateClinicalSessionInput,
    ): Promise<void> {
        const query = this.clinicalSessionRepository
            .createQueryBuilder('session')
            .innerJoin('session.calendarOccurrence', 'occurrence')
            .where('session."sessionKind" = :sessionKind', {
                sessionKind: input.sessionKind,
            })
            .andWhere('session."clinicalStatus" != :cancelledStatus', {
                cancelledStatus: ClinicalSessionStatus.CANCELLED,
            })
            .andWhere(
                input.patientId
                    ? 'session."patientId" = :patientId'
                    : 'session."patientId" IS NULL',
                { patientId: input.patientId },
            );

        const sessionsBefore = await query
            .andWhere('occurrence."startAt" < :startAt', { startAt: input.startAt })
            .getCount();

        if (!input.sessionNumber || input.sessionNumber !== sessionsBefore + 1) {
            input.sessionNumber = sessionsBefore + 1;
        }
    }

    private async normalizeSessionNumbersForSession(
        referenceSession: ClinicalSession,
    ): Promise<void> {
        const query = this.clinicalSessionRepository
            .createQueryBuilder('session')
            .innerJoinAndSelect('session.calendarOccurrence', 'occurrence')
            .where('session."sessionKind" = :sessionKind', {
                sessionKind: referenceSession.sessionKind,
            })
            .andWhere('session."clinicalStatus" != :cancelledStatus', {
                cancelledStatus: ClinicalSessionStatus.CANCELLED,
            })
            .orderBy('occurrence."startAt"', 'ASC')
            .addOrderBy('session.id', 'ASC');

        if (referenceSession.patientId) {
            query.andWhere('session."patientId" = :patientId', {
                patientId: referenceSession.patientId,
            });
        } else {
            query.andWhere('session."patientId" IS NULL');
        }

        const sessions = await query.getMany();
        for (const [index, session] of sessions.entries()) {
            const nextSessionNumber = index + 1;
            if (session.sessionNumber === nextSessionNumber) continue;
            const previousSessionNumber = session.sessionNumber;
            session.sessionNumber = nextSessionNumber;
            await this.clinicalSessionRepository.save(session);
            await this.syncPendingResourcesAfterRenumber(session, previousSessionNumber);
        }
    }

    private async syncPendingResourcesAfterRenumber(
        session: ClinicalSession,
        previousSessionNumber?: number,
    ): Promise<void> {
        if (!session.sessionNumber || previousSessionNumber === session.sessionNumber) return;

        const occurrence = session.calendarOccurrence || await this.occurrenceRepository.findOne(session.calendarOccurrenceId);
        if (!occurrence) return;

        const patient = session.patientId
            ? await this.patientRepository.findOne(session.patientId)
            : null;
        const applications = await this.activeSchemeApplicationsForSessionContext(session);
        if (applications.length) {
            for (const application of applications) {
                await this.syncPendingResourcesForSchemeApplication(
                    session,
                    occurrence,
                    patient || undefined,
                    application,
                );
            }
            return;
        }

        if (occurrence.schemeId) {
            await this.syncPendingResourcesForSchemeId(
                session,
                occurrence,
                patient || undefined,
                occurrence.schemeId,
                session.sessionNumber,
            );
        }
    }

    private async syncActiveSchemeResourcesFrom(
        referenceSession: ClinicalSession,
        currentUser?: User,
    ): Promise<void> {
        await this.ensureLegacySchemeApplicationsForSession(referenceSession);
        const applications = await this.activeSchemeApplicationsForSessionContext(referenceSession);
        if (!applications.length) return;

        const sessions = await this.futureSessionsFrom(referenceSession, true);
        for (const session of sessions) {
            for (const application of applications) {
                const schemeSessionNumber = await this.resolveSchemeSessionNumberForApplication(
                    session,
                    application,
                );
                if (!schemeSessionNumber) continue;
                const applicationMap = new Map<number, ClinicalSessionSchemeApplication>([
                    [application.schemeId, application],
                ]);
                await this.addSchemeResourcesToSession(
                    session,
                    [application.schemeId],
                    currentUser,
                    schemeSessionNumber,
                    applicationMap,
                );
            }
        }
    }

    private async activeSchemeApplicationsForSessionContext(
        session: ClinicalSession,
    ): Promise<ClinicalSessionSchemeApplication[]> {
        const query = this.schemeApplicationRepository
            .createQueryBuilder('application')
            .leftJoinAndSelect('application.scheme', 'scheme')
            .leftJoinAndSelect('application.startSession', 'startSession')
            .where('application."sessionKind" = :sessionKind', {
                sessionKind: session.sessionKind,
            })
            .andWhere('application.status = :status', {
                status: ClinicalSessionSchemeApplicationStatus.ACTIVE,
            })
            .orderBy('application."createdAt"', 'ASC');

        this.applySchemeApplicationContextFilter(query, session);
        return query.getMany();
    }

    private async resolveSchemeSessionNumberForApplication(
        session: ClinicalSession,
        application: ClinicalSessionSchemeApplication,
    ): Promise<number | undefined> {
        if (application.applicationMode === ClinicalSessionSchemeApplicationMode.ORIGINAL_SESSION_NUMBER) {
            return session.sessionNumber;
        }

        const sessionOccurrence = session.calendarOccurrence ||
            await this.occurrenceRepository.findOne(session.calendarOccurrenceId);
        const startSession = application.startSession || (
            application.startClinicalSessionId
                ? await this.clinicalSessionRepository.findOne(application.startClinicalSessionId, {
                    relations: ['calendarOccurrence'],
                })
                : undefined
        );
        const startOccurrence = startSession?.calendarOccurrence || (
            startSession?.calendarOccurrenceId
                ? await this.occurrenceRepository.findOne(startSession.calendarOccurrenceId)
                : undefined
        );
        if (!sessionOccurrence || !startOccurrence) return session.sessionNumber;

        const query = this.clinicalSessionRepository
            .createQueryBuilder('session')
            .innerJoin('session.calendarOccurrence', 'occurrence')
            .where('session."sessionKind" = :sessionKind', {
                sessionKind: session.sessionKind,
            })
            .andWhere('session."clinicalStatus" != :cancelledStatus', {
                cancelledStatus: ClinicalSessionStatus.CANCELLED,
            })
            .andWhere('occurrence."startAt" >= :startAt', {
                startAt: startOccurrence.startAt,
            })
            .andWhere('occurrence."startAt" <= :endAt', {
                endAt: sessionOccurrence.startAt,
            });

        if (session.patientId) {
            query.andWhere('session."patientId" = :patientId', {
                patientId: session.patientId,
            });
        } else {
            query
                .andWhere('session."patientId" IS NULL')
                .andWhere('session."therapistId" = :therapistId', {
                    therapistId: session.therapistId,
                });
        }

        return query.getCount();
    }

    private async syncPendingResourcesForSchemeApplication(
        session: ClinicalSession,
        occurrence: CalendarOccurrence,
        patient: Patient | undefined,
        application: ClinicalSessionSchemeApplication,
    ): Promise<void> {
        const schemeSessionNumber = await this.resolveSchemeSessionNumberForApplication(
            session,
            application,
        );
        if (!schemeSessionNumber) return;
        await this.syncPendingResourcesForSchemeId(
            session,
            occurrence,
            patient,
            application.schemeId,
            schemeSessionNumber,
            application,
        );
    }

    private async syncPendingResourcesForSchemeId(
        session: ClinicalSession,
        occurrence: CalendarOccurrence,
        patient: Patient | undefined,
        schemeId: number,
        schemeSessionNumber?: number,
        application?: ClinicalSessionSchemeApplication,
    ): Promise<void> {
        const sessionInput = {
            ...this.buildSessionInputForResourceSync(session, occurrence, patient),
            schemeId,
            schemeIds: [schemeId],
        };
        const desiredResourceInputs = await this.buildResourcesFromScheme(
            sessionInput,
            undefined,
            schemeSessionNumber,
        );
        const desiredTemplateIds = desiredResourceInputs
            .map(resource => resource.resourceTemplateId)
            .filter((id): id is number => !!id);

        const currentResources = await this.resourceRepository.find({
            where: application
                ? { clinicalSessionId: session.id, schemeApplicationId: application.id }
                : { clinicalSessionId: session.id },
            relations: ['assessment'],
        });

        for (const resource of currentResources) {
            if (!resource.resourceTemplateId) continue;
            if (this.resourceProtectedFromRenumber(resource)) continue;

            if (!desiredTemplateIds.includes(resource.resourceTemplateId)) {
                await this.cancelPendingResourceAfterRenumber(resource);
                continue;
            }

            const desiredInput = desiredResourceInputs.find(
                input => input.resourceTemplateId === resource.resourceTemplateId,
            );
            if (desiredInput) {
                await this.updatePendingResourceFromTemplate(
                    resource,
                    occurrence,
                    {
                        ...desiredInput,
                        schemeApplicationId: application?.id,
                        schemeRelativeSessionNumber: schemeSessionNumber,
                    },
                );
            }
        }

        const refreshedResources = await this.resourceRepository.find({
            where: application
                ? { clinicalSessionId: session.id, schemeApplicationId: application.id }
                : { clinicalSessionId: session.id },
        });
        const activeTemplateIds = refreshedResources
            .filter(resource => ![
                ClinicalSessionResourceStatus.CANCELLED,
                ClinicalSessionResourceStatus.DETACHED,
            ].includes(resource.status))
            .map(resource => resource.resourceTemplateId)
            .filter((id): id is number => !!id);

        for (const desiredInput of desiredResourceInputs) {
            if (!desiredInput.resourceTemplateId) continue;
            if (activeTemplateIds.includes(desiredInput.resourceTemplateId)) continue;
            await this.createResourceForSession(
                session,
                occurrence,
                {
                    ...desiredInput,
                    schemeApplicationId: application?.id,
                    schemeRelativeSessionNumber: schemeSessionNumber,
                },
                sessionInput,
            );
        }
    }

    private buildSessionInputForResourceSync(
        session: ClinicalSession,
        occurrence: CalendarOccurrence,
        patient?: Patient,
    ): CreateClinicalSessionInput {
        return {
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
            treatmentCycleId: session.treatmentCycleId,
            targetUserId: patient?.userId || session.therapistId,
            therapistId: session.therapistId,
            supervisorId: session.supervisorId,
            responsibleUserIds: this.uniqueIds([
                ...(session.responsibleUsers || []).map(user => user.id),
                session.therapistId,
                session.supervisorId,
            ]),
        };
    }

    private resourceProtectedFromRenumber(resource: ClinicalSessionResource): boolean {
        if (resource.assessment) {
            return this.assessmentProtectedFromRenumber(resource.assessment);
        }
        return resource.activationAt
            ? new Date(resource.activationAt).getTime() < Date.now()
            : false;
    }

    private assessmentProtectedFromRenumber(assessment: Assessment): boolean {
        if (this.isAssessmentAnswered(assessment)) return true;
        return assessment.deliveryDate
            ? new Date(assessment.deliveryDate).getTime() < Date.now()
            : false;
    }

    private async cancelPendingResourceAfterRenumber(
        resource: ClinicalSessionResource,
    ): Promise<void> {
        resource.status = ClinicalSessionResourceStatus.CANCELLED;
        await this.resourceRepository.save(resource);

        if (resource.assessmentId) {
            await this.assessmentService.deleteAssessment(resource.assessmentId, true);
        }
    }

    private async updatePendingResourceFromTemplate(
        resource: ClinicalSessionResource,
        occurrence: CalendarOccurrence,
        desiredInput: CreateClinicalSessionResourceInput,
    ): Promise<void> {
        resource.resourceKind = desiredInput.resourceKind;
        resource.activationAnchor = desiredInput.activationAnchor;
        resource.activationOffsetMinutes = desiredInput.activationOffsetMinutes;
        resource.availabilityDurationMinutes = desiredInput.availabilityDurationMinutes;
        resource.reminderMinutes = desiredInput.reminderMinutes || [];
        resource.schemeRelativeSessionNumber = desiredInput.schemeRelativeSessionNumber;

        const timing = this.resolveResourceTiming(
            occurrence.startAt,
            occurrence.endAt,
            desiredInput,
        );
        resource.activationAt = timing.activationAt;
        resource.expirationAt = timing.expirationAt;
        await this.resourceRepository.save(resource);

        const assessment = resource.assessment || (resource.assessmentId
            ? await this.assessmentRepository.findOne(resource.assessmentId)
            : null);
        if (!assessment || this.assessmentProtectedFromRenumber(assessment)) return;

        assessment.deliveryDate = timing.activationAt;
        assessment.expirationDate = timing.expirationAt;
        assessment.reminderMinutes = resource.reminderMinutes || [];
        assessment.schemeRelativeSessionNumber = desiredInput.schemeRelativeSessionNumber;
        await this.assessmentRepository.save(assessment);
    }

    private async buildResourcesFromScheme(
        input: CreateClinicalSessionInput,
        currentUser?: User,
        schemeSessionNumber = input.sessionNumber,
    ): Promise<CreateClinicalSessionResourceInput[]> {
        const schemeIds = this.schemeIds(input);
        if (!schemeIds.length || !schemeSessionNumber) return [];

        const sessionTemplates = await this.sessionTemplateRepository.find({
            where: schemeIds.map(schemeId => ({ schemeId })),
        });
        if (!sessionTemplates.length) return [];
        const sessionTemplateById = new Map(
            sessionTemplates.map(sessionTemplate => [sessionTemplate.id, sessionTemplate]),
        );

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
                this.resourceAppliesToSession(
                    resourceTemplate,
                    schemeSessionNumber,
                    sessionTemplateById.get(resourceTemplate.sessionTemplateId),
                ),
            )
            .map(resourceTemplate => ({
                resourceTemplateId: resourceTemplate.id,
                schemeId: sessionTemplateById.get(resourceTemplate.sessionTemplateId)?.schemeId,
                schemeRelativeSessionNumber: schemeSessionNumber,
                resourceKind: resourceTemplate.resourceKind,
                assessmentTypeId: resourceTemplate.assessmentTypeId,
                questionnaires: resourceTemplate.questionnaireIds || [],
                questionnaireBundles: resourceTemplate.questionnaireBundleIds || [],
                randomizationRuleIds: resourceTemplate.randomizationRuleIds || [],
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
        sessionTemplate?: SchemeSessionTemplate,
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

        if (sessionTemplate?.sessionIndex) {
            return sessionTemplate.sessionIndex === sessionNumber;
        }

        return sessionTemplate?.sessionIndex === 0;
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
                responsibleUserIds: this.uniqueIds([
                    ...(session.responsibleUsers || []).map(user => user.id),
                    session.therapistId,
                    session.supervisorId,
                ]),
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
                responsibleUserIds: sessionInput.responsibleUserIds,
                mailTemplateId: resourceInput.mailTemplateId,
                informantType:
                    resourceInput.informantType || defaultInformantType,
                note: resourceInput.note,
                questionnaires: resourceInput.questionnaires || [],
                questionnaireBundles: resourceInput.questionnaireBundles || [],
                randomizationRuleIds: resourceInput.randomizationRuleIds || [],
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
        assessment.treatmentCycleId = session.treatmentCycleId || sessionInput.treatmentCycleId;
        assessment.schemeId = resourceInput.schemeId || sessionInput.schemeId || occurrence.schemeId;
        assessment.schemeAssignmentId = occurrence.schemeAssignmentId;
        assessment.schemeResourceTemplateId = resourceInput.resourceTemplateId;
        assessment.schemeApplicationId = resourceInput.schemeApplicationId;
        assessment.schemeRelativeSessionNumber = resourceInput.schemeRelativeSessionNumber;
        await this.assessmentRepository.save(assessment);

        return assessment;
    }

    private async resolveActiveTreatmentCycleId(
        input: Pick<CreateClinicalSessionInput, 'sessionKind' | 'patientId' | 'therapistId'>,
    ): Promise<number | undefined> {
        const query = this.treatmentCycleRepository
            .createQueryBuilder('cycle')
            .where('cycle.status = :status', { status: TreatmentCycleStatus.ACTIVE })
            .orderBy('cycle."cycleNumber"', 'DESC')
            .addOrderBy('cycle."startedAt"', 'DESC');

        if (input.sessionKind === ClinicalSessionKind.SUPERVISION) {
            if (!input.therapistId) return undefined;
            query
                .andWhere('cycle."cycleKind" = :kind', { kind: TreatmentCycleKind.SUPERVISION })
                .andWhere('cycle."therapistId" = :therapistId', {
                    therapistId: input.therapistId,
                });
        } else {
            if (!input.patientId) return undefined;
            query
                .andWhere('cycle."cycleKind" = :kind', { kind: TreatmentCycleKind.CLINICAL })
                .andWhere('cycle."patientId" = :patientId', { patientId: input.patientId });
        }

        const cycle = await query.getOne();
        return cycle?.id;
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
            schemeApplicationId: resource.schemeApplicationId,
            schemeRelativeSessionNumber: resource.schemeRelativeSessionNumber,
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

    private addDays(date: Date, days: number): Date {
        const next = new Date(date);
        next.setDate(next.getDate() + days);
        return next;
    }

    private addRepeatPeriod(
        date: Date,
        amount: number,
        unit: ClinicalSessionRepeatUnit,
    ): Date {
        const next = new Date(date);
        if (unit === ClinicalSessionRepeatUnit.DAY) {
            next.setDate(next.getDate() + amount);
        } else if (unit === ClinicalSessionRepeatUnit.WEEK) {
            next.setDate(next.getDate() + amount * 7);
        } else if (unit === ClinicalSessionRepeatUnit.MONTH) {
            next.setMonth(next.getMonth() + amount);
        } else {
            next.setFullYear(next.getFullYear() + amount);
        }
        return next;
    }

    private startOfWeek(date: Date): Date {
        const start = new Date(date);
        start.setDate(start.getDate() - start.getDay());
        start.setHours(0, 0, 0, 0);
        return start;
    }

    private endOfDay(date: Date): Date {
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        return end;
    }

    private copyTime(date: Date, source: Date): Date {
        const next = new Date(date);
        next.setHours(
            source.getHours(),
            source.getMinutes(),
            source.getSeconds(),
            source.getMilliseconds(),
        );
        return next;
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
