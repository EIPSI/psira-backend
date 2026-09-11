import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Assessment } from 'src/modules/assessment/models/assessment.model';
import { CalendarOccurrenceStatus } from 'src/modules/calendar/enums/calendar-occurrence-status.enum';
import { CalendarOccurrence } from 'src/modules/calendar/models/calendar-occurrence.model';
import { ClinicalSessionCancellationLabel } from 'src/modules/clinical-session/enums/clinical-session-cancellation-label.enum';
import { ClinicalSessionCancellationType } from 'src/modules/clinical-session/enums/clinical-session-cancellation-type.enum';
import { ClinicalSessionStatus } from 'src/modules/clinical-session/enums/clinical-session-status.enum';
import { ClinicalSessionResource } from 'src/modules/clinical-session/models/clinical-session-resource.model';
import { ClinicalSession } from 'src/modules/clinical-session/models/clinical-session.model';
import { EvaluationAutomationTriggerPoint } from 'src/modules/evaluation-automation/enums/evaluation-automation-trigger-point.enum';
import { Patient } from 'src/modules/patient/models/patient.model';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { AssessmentStatus } from 'src/modules/questionnaire/enums/assessment-status.enum';
import { SettingService } from 'src/modules/setting/providers/setting.service';
import { User } from 'src/modules/user/models/user.model';
import { getManager, Repository } from 'typeorm';
import {
    CancelTreatmentCycleFinalizationInput,
    CaseHistoryFilterInput,
    CreateCaseHistoryNoteInput,
    FinalizeTreatmentCycleInput,
    StartNewTreatmentCycleInput,
    TreatmentCycleListFilterInput,
} from '../dtos/treatment-cycle.input';
import { CaseHistoryEntryKind } from '../enums/case-history-entry-kind.enum';
import { CaseEventReasonContext } from '../enums/case-event-reason-context.enum';
import { TreatmentCycleKind } from '../enums/treatment-cycle-kind.enum';
import { TreatmentCycleStatus } from '../enums/treatment-cycle-status.enum';
import { CaseHistoryEntry } from '../models/case-history-entry.model';
import { CaseEventReason } from '../models/case-event-reason.model';
import { TreatmentCycle } from '../models/treatment-cycle.model';
import { CaseEventReasonService } from './case-event-reason.service';

interface FinalizationSnapshot {
    cancelledSessions: Array<{
        id: number;
        sessionNumber?: number;
        clinicalStatus: ClinicalSessionStatus;
        cancellationType?: ClinicalSessionCancellationType;
        cancellationLabel?: ClinicalSessionCancellationLabel;
        cancellationReasonId?: number;
        cancellationReasonSnapshot?: string;
        cancellationComment?: string;
        cancelledAt?: Date;
        cancelledSessionNumber?: number;
        cancelledStartAt?: Date;
        occurrenceId?: number;
        occurrenceStatus?: CalendarOccurrenceStatus;
        occurrenceCancellationReason?: string;
    }>;
    cancelledAssessments: Array<{
        id: number;
        status: string;
    }>;
    deletedInactiveSessionIds: number[];
}

@Injectable()
export class TreatmentCycleService {
    private readonly logger = new Logger('TreatmentCycleService');

    constructor(
        @InjectRepository(TreatmentCycle)
        private readonly cycleRepository: Repository<TreatmentCycle>,
        @InjectRepository(CaseEventReason)
        private readonly reasonRepository: Repository<CaseEventReason>,
        @InjectRepository(CaseHistoryEntry)
        private readonly historyEntryRepository: Repository<CaseHistoryEntry>,
        @InjectRepository(ClinicalSession)
        private readonly sessionRepository: Repository<ClinicalSession>,
        @InjectRepository(ClinicalSessionResource)
        private readonly resourceRepository: Repository<ClinicalSessionResource>,
        @InjectRepository(CalendarOccurrence)
        private readonly occurrenceRepository: Repository<CalendarOccurrence>,
        @InjectRepository(Assessment)
        private readonly assessmentRepository: Repository<Assessment>,
        @InjectRepository(Patient)
        private readonly patientRepository: Repository<Patient>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly reasonService: CaseEventReasonService,
        private readonly settingService: SettingService,
        private readonly moduleRef: ModuleRef,
    ) {}

    async listCycles(filter: TreatmentCycleListFilterInput = {}): Promise<TreatmentCycle[]> {
        const query = this.cycleRepository
            .createQueryBuilder('cycle')
            .leftJoinAndSelect('cycle.patient', 'patient')
            .leftJoinAndSelect('cycle.therapist', 'therapist')
            .leftJoinAndSelect('cycle.finalizationReason', 'finalizationReason')
            .leftJoinAndSelect('cycle.newTreatmentReason', 'newTreatmentReason')
            .leftJoinAndSelect('cycle.lastClinicalSession', 'lastClinicalSession')
            .orderBy('cycle."cycleNumber"', 'DESC')
            .addOrderBy('cycle."startedAt"', 'DESC');

        if (filter.cycleKind) {
            query.andWhere('cycle."cycleKind" = :cycleKind', { cycleKind: filter.cycleKind });
        }
        if (filter.patientId) {
            query.andWhere('cycle."patientId" = :patientId', { patientId: filter.patientId });
        }
        if (filter.therapistId) {
            query.andWhere('cycle."therapistId" = :therapistId', { therapistId: filter.therapistId });
        }
        if (filter.activeOnly) {
            query.andWhere('cycle.status = :status', { status: TreatmentCycleStatus.ACTIVE });
        }

        return query.getMany();
    }

    async getCycle(id: number): Promise<TreatmentCycle> {
        const cycle = await this.cycleRepository.findOne(id, {
            relations: [
                'patient',
                'therapist',
                'finalizationReason',
                'newTreatmentReason',
                'lastClinicalSession',
            ],
        });
        if (!cycle) throw new NotFoundException('Treatment cycle not found');
        return cycle;
    }

    async getActiveCycle(filter: TreatmentCycleListFilterInput): Promise<TreatmentCycle | undefined> {
        const activeCycle = (await this.listCycles({ ...filter, activeOnly: true }))[0];
        if (activeCycle) return activeCycle;
        return (await this.listCycles({ ...filter, activeOnly: false }))[0];
    }

    private async getStrictActiveCycle(
        filter: TreatmentCycleListFilterInput,
    ): Promise<TreatmentCycle | undefined> {
        return (await this.listCycles({ ...filter, activeOnly: true }))[0];
    }

    async finalizeCycle(
        input: FinalizeTreatmentCycleInput,
        currentUser?: User,
    ): Promise<TreatmentCycle> {
        const cycle = await this.resolveCycleForFinalization(input);
        if (cycle.status !== TreatmentCycleStatus.ACTIVE) {
            throw new BadRequestException('Treatment cycle is not active');
        }
        await this.assertCanManageCycle(cycle, currentUser);
        await this.assertFinalizationReason(input.finalizationReasonId, cycle.cycleKind);

        const finalizedAt = input.finalizedAt ? new Date(input.finalizedAt) : new Date();
        const sessions = await this.getCycleSessions(cycle.id);
        const lastSession = this.resolveLastSessionForFinalization(
            sessions,
            finalizedAt,
            input.lastSessionNumber,
        );
        const sessionsAfterSelectedLastSession = lastSession
            ? sessions.filter(session =>
                this.sessionStartTime(session) > this.sessionStartTime(lastSession) &&
                session.clinicalStatus !== ClinicalSessionStatus.CANCELLED,
            )
            : [];

        const futureSessions = sessions.filter(session =>
            this.sessionStartTime(session) > finalizedAt.getTime() &&
            session.clinicalStatus !== ClinicalSessionStatus.CANCELLED,
        );
        const sessionsToCancel = this.uniqueSessions([
            ...sessionsAfterSelectedLastSession,
            ...futureSessions,
        ]);
        const assessmentCancellationCutoff = lastSession
            ? new Date(this.sessionStartTime(lastSession))
            : finalizedAt;
        const futureAssessments = await this.getFutureCycleAssessments(
            cycle.id,
            assessmentCancellationCutoff,
        );
        const snapshot = await this.cancelFutureWorkForFinalization(
            sessionsToCancel,
            futureAssessments,
            input.finalizationReasonId,
        );
        snapshot.deletedInactiveSessionIds = [];

        const undoWindowDays = await this.settingService.getKey(
            'treatmentFinalizationUndoWindowDays',
        );
        const finalizationReasonSnapshot = await this.reasonService.reasonPathSnapshot(
            input.finalizationReasonId,
        );
        const finalizationUndoExpiresAt = this.addDays(
            new Date(),
            undoWindowDays || 30,
        );
        await this.cycleRepository.update(cycle.id, {
            status: TreatmentCycleStatus.FINALIZED,
            finalizedAt,
            finalizationReasonId: input.finalizationReasonId,
            finalizationReasonSnapshot,
            finalizationOtherReason: input.finalizationOtherReason,
            finalizationNote: input.finalizationNote,
            lastClinicalSessionId: lastSession?.id,
            lastSessionNumber: input.lastSessionNumber || lastSession?.sessionNumber,
            finalizationUndoExpiresAt,
            finalizationSnapshot: snapshot as any,
        });

        const savedCycle = await this.getCycle(cycle.id);
        await this.createHistoryEntry({
            entryKind: CaseHistoryEntryKind.TREATMENT_FINALIZATION,
            cycle: savedCycle,
            occurredAt: finalizedAt,
            title: savedCycle.cycleKind === TreatmentCycleKind.SUPERVISION
                ? 'Finalizacion de supervision'
                : 'Finalizacion de tratamiento',
            content: input.finalizationNote,
            reasonSnapshot: savedCycle.finalizationReasonSnapshot,
            sessionNumber: savedCycle.lastSessionNumber,
            metadata: {
                lastClinicalSessionId: savedCycle.lastClinicalSessionId,
                finalizationOtherReason: savedCycle.finalizationOtherReason,
                finalizationUndoExpiresAt: savedCycle.finalizationUndoExpiresAt,
            },
        });
        await this.dispatchCycleAutomation(
            EvaluationAutomationTriggerPoint.TREATMENT_FINALIZATION,
            savedCycle,
            currentUser,
            input.finalizationReasonId,
            finalizedAt,
            input.excludedAutomationIds,
            {
                lastSessionNumber: savedCycle.lastSessionNumber,
                finalizationReasonSnapshot: savedCycle.finalizationReasonSnapshot,
                finalizationOtherReason: savedCycle.finalizationOtherReason,
            },
        );

        return savedCycle;
    }

    async cancelFinalization(
        input: CancelTreatmentCycleFinalizationInput,
        currentUser?: User,
    ): Promise<TreatmentCycle> {
        const cycle = await this.getCycle(input.treatmentCycleId);
        if (cycle.status !== TreatmentCycleStatus.FINALIZED) {
            throw new BadRequestException('Only finalized cycles can have their finalization cancelled');
        }
        await this.assertCanManageCycle(cycle, currentUser);
        if (
            cycle.finalizationUndoExpiresAt &&
            new Date(cycle.finalizationUndoExpiresAt).getTime() < Date.now()
        ) {
            throw new BadRequestException('The finalization cancellation window has expired');
        }

        const activeCycle = await this.getStrictActiveCycle({
            cycleKind: cycle.cycleKind,
            patientId: cycle.patientId,
            therapistId: cycle.therapistId,
        });
        if (activeCycle && activeCycle.id !== cycle.id) {
            throw new BadRequestException('Another active cycle already exists for this case');
        }

        await this.restoreFinalizationSnapshot(cycle.finalizationSnapshot as FinalizationSnapshot);

        cycle.status = TreatmentCycleStatus.ACTIVE;
        cycle.finalizationCancelledAt = new Date();
        cycle.finalizationCancellationNote = input.note;
        cycle.finalizedAt = null;
        cycle.finalizationUndoExpiresAt = null;
        cycle.finalizationReasonId = null;
        cycle.finalizationReasonSnapshot = null;
        cycle.finalizationOtherReason = null;

        const savedCycle = await this.cycleRepository.save(cycle);
        await this.createHistoryEntry({
            entryKind: CaseHistoryEntryKind.FINALIZATION_CANCELLED,
            cycle: savedCycle,
            occurredAt: savedCycle.finalizationCancelledAt,
            title: savedCycle.cycleKind === TreatmentCycleKind.SUPERVISION
                ? 'Anulacion de finalizacion de supervision'
                : 'Anulacion de finalizacion de tratamiento',
            content: input.note,
        });

        return savedCycle;
    }

    async startNewTreatmentCycle(
        input: StartNewTreatmentCycleInput,
        currentUser?: User,
    ): Promise<TreatmentCycle> {
        const previousCycle = await this.resolvePreviousCycleForNewTreatment(input);
        await this.assertCanManageCycle(previousCycle, currentUser);
        await this.assertNewTreatmentReason(input.newTreatmentReasonId, previousCycle.cycleKind);

        const activeCycle = await this.getStrictActiveCycle({
            cycleKind: previousCycle.cycleKind,
            patientId: previousCycle.patientId,
            therapistId: previousCycle.therapistId,
        });
        if (activeCycle) {
            throw new BadRequestException('This case already has an active cycle');
        }

        const startedAt = input.startedAt ? new Date(input.startedAt) : new Date();
        const reasonSnapshot = await this.reasonService.reasonPathSnapshot(
            input.newTreatmentReasonId,
        );
        const previousCycles = await this.listCycles({
            cycleKind: previousCycle.cycleKind,
            patientId: previousCycle.patientId,
            therapistId: previousCycle.therapistId,
        });
        const finalizedAt = previousCycle.finalizedAt
            ? new Date(previousCycle.finalizedAt)
            : undefined;
        const nextCycle = this.cycleRepository.create({
            cycleKind: previousCycle.cycleKind,
            status: TreatmentCycleStatus.ACTIVE,
            cycleNumber: Math.max(...previousCycles.map(cycle => cycle.cycleNumber), 0) + 1,
            patientId: previousCycle.patientId,
            therapistId: previousCycle.therapistId,
            startedAt,
            newTreatmentReasonId: input.newTreatmentReasonId,
            newTreatmentReasonSnapshot: reasonSnapshot,
            newTreatmentOtherReason: input.newTreatmentOtherReason,
            newTreatmentNote: input.newTreatmentNote,
            daysSincePreviousFinalization: finalizedAt
                ? Math.max(0, Math.floor((startedAt.getTime() - finalizedAt.getTime()) / 86400000))
                : undefined,
            previousCycleCount: previousCycles.length,
        });

        const savedCycle = await this.cycleRepository.save(nextCycle);
        await this.createHistoryEntry({
            entryKind: CaseHistoryEntryKind.NEW_TREATMENT,
            cycle: savedCycle,
            occurredAt: startedAt,
            title: savedCycle.cycleKind === TreatmentCycleKind.SUPERVISION
                ? 'Nueva supervision'
                : 'Nuevo tratamiento',
            content: input.newTreatmentNote,
            reasonSnapshot,
            metadata: {
                previousTreatmentCycleId: previousCycle.id,
                newTreatmentOtherReason: input.newTreatmentOtherReason,
                daysSincePreviousFinalization: savedCycle.daysSincePreviousFinalization,
                previousCycleCount: savedCycle.previousCycleCount,
            },
        });
        await this.dispatchCycleAutomation(
            EvaluationAutomationTriggerPoint.NEW_TREATMENT,
            savedCycle,
            currentUser,
            input.newTreatmentReasonId,
            startedAt,
            input.excludedAutomationIds,
            {
                previousTreatmentCycleId: previousCycle.id,
                newTreatmentReasonSnapshot: reasonSnapshot,
                newTreatmentOtherReason: input.newTreatmentOtherReason,
                daysSincePreviousFinalization: savedCycle.daysSincePreviousFinalization,
                previousCycleCount: savedCycle.previousCycleCount,
            },
        );

        return savedCycle;
    }

    async createCaseHistoryNote(
        input: CreateCaseHistoryNoteInput,
        currentUser?: User,
    ): Promise<CaseHistoryEntry> {
        const cycle = input.treatmentCycleId
            ? await this.getCycle(input.treatmentCycleId)
            : await this.getActiveCycle({
                cycleKind: input.cycleKind,
                patientId: input.patientId,
                therapistId: input.therapistId,
            });
        if (!cycle) throw new NotFoundException('Treatment cycle not found');
        await this.assertCanManageCycle(cycle, currentUser);

        return this.createHistoryEntry({
            entryKind: CaseHistoryEntryKind.NOTE,
            cycle,
            occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
            title: input.title,
            content: input.content,
        });
    }

    async caseHistoryEntries(filter: CaseHistoryFilterInput): Promise<CaseHistoryEntry[]> {
        const query = this.historyEntryRepository
            .createQueryBuilder('entry')
            .leftJoinAndSelect('entry.treatmentCycle', 'cycle')
            .leftJoinAndSelect('entry.patient', 'patient')
            .leftJoinAndSelect('entry.therapist', 'therapist')
            .leftJoinAndSelect('entry.clinicalSession', 'clinicalSession')
            .where('1 = 1');

        if (filter.cycleKind) {
            query.andWhere('entry."cycleKind" = :cycleKind', { cycleKind: filter.cycleKind });
        }
        if (filter.patientId) {
            query.andWhere('entry."patientId" = :patientId', { patientId: filter.patientId });
        }
        if (filter.therapistId) {
            query.andWhere('entry."therapistId" = :therapistId', { therapistId: filter.therapistId });
        }
        if (filter.from) {
            query.andWhere('entry."occurredAt" >= :from', { from: filter.from });
        }
        if (filter.to) {
            query.andWhere('entry."occurredAt" <= :to', { to: filter.to });
        }

        const entries = await query
            .orderBy('entry."occurredAt"', filter.sortDirection === 'ASC' ? 'ASC' : 'DESC')
            .addOrderBy('entry.id', filter.sortDirection === 'ASC' ? 'ASC' : 'DESC')
            .getMany();
        const assessmentIds = entries
            .map(entry => entry.metadata?.assessmentId)
            .filter((id): id is number => !!id);
        const assessmentById = new Map<number, Assessment>();
        if (assessmentIds.length) {
            const assessments = await this.assessmentRepository
                .createQueryBuilder('assessment')
                .leftJoinAndSelect('assessment.assessmentType', 'assessmentType')
                .where('assessment.id IN (:...ids)', { ids: [...new Set(assessmentIds)] })
                .getMany();
            assessments.forEach(assessment => assessmentById.set(assessment.id, assessment));
        }
        return entries.map(entry => {
            const assessment = entry.metadata?.assessmentId
                ? assessmentById.get(entry.metadata.assessmentId)
                : undefined;
            entry.assessmentId = entry.metadata?.assessmentId;
            entry.assessmentTypeId = entry.metadata?.assessmentTypeId || assessment?.assessmentTypeId;
            entry.questionnaireAssessmentId = entry.metadata?.questionnaireAssessmentId || assessment?.questionnaireAssessmentId;
            entry.assessmentName = entry.metadata?.assessmentName || assessment?.name;
            entry.assessmentTypeName = entry.metadata?.assessmentTypeName || assessment?.assessmentType?.name;
            return entry;
        });
    }

    private async dispatchCycleAutomation(
        triggerPoint: EvaluationAutomationTriggerPoint,
        cycle: TreatmentCycle,
        currentUser: User | undefined,
        reasonId: number | undefined,
        occurredAt: Date,
        excludedAutomationIds: number[] = [],
        metadata: Record<string, any> = {},
    ): Promise<void> {
        const automationEngine = this.resolveAutomationEngine();
        if (!automationEngine) return;
        try {
            const target = await this.resolveAutomationTargetUser(cycle, currentUser);
            if (!target) return;
            await automationEngine.handleTrigger({
                triggerPoint,
                userId: target.id,
                patientId: cycle.patientId,
                therapistId: cycle.therapistId,
                treatmentCycleId: cycle.id,
                reasonId,
                reasonContext: this.reasonContextForCycleTrigger(triggerPoint, cycle.cycleKind),
                triggerOccurredAt: occurredAt,
                excludedAutomationIds,
                metadata: {
                    cycleKind: cycle.cycleKind,
                    cycleNumber: cycle.cycleNumber,
                    ...metadata,
                },
            });
        } catch (error) {
            this.logger.error(
                `Unable to dispatch ${triggerPoint} automation for cycle ${cycle.id}: ${error?.message}`,
            );
        }
    }

    private reasonContextForCycleTrigger(
        triggerPoint: EvaluationAutomationTriggerPoint,
        cycleKind: TreatmentCycleKind,
    ): CaseEventReasonContext | undefined {
        const isSupervision = cycleKind === TreatmentCycleKind.SUPERVISION;
        if (triggerPoint === EvaluationAutomationTriggerPoint.TREATMENT_FINALIZATION) {
            return isSupervision
                ? CaseEventReasonContext.SUPERVISION_FINALIZATION
                : CaseEventReasonContext.TREATMENT_FINALIZATION;
        }
        if (triggerPoint === EvaluationAutomationTriggerPoint.NEW_TREATMENT) {
            return isSupervision
                ? CaseEventReasonContext.NEW_SUPERVISION
                : CaseEventReasonContext.NEW_TREATMENT;
        }
        return undefined;
    }

    private async resolveAutomationTargetUser(
        cycle: TreatmentCycle,
        currentUser?: User,
    ): Promise<User | undefined> {
        if (cycle.patientId) {
            const patient = cycle.patient || await this.patientRepository.findOne(cycle.patientId);
            if (patient?.userId) {
                const patientUser = await this.userRepository.findOne(patient.userId);
                if (patientUser) return patientUser;
            }
        }
        if (cycle.therapistId) {
            const therapist = await this.userRepository.findOne(cycle.therapistId);
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

    private async resolveCycleForFinalization(
        input: FinalizeTreatmentCycleInput,
    ): Promise<TreatmentCycle> {
        if (input.treatmentCycleId) {
            return this.getCycle(input.treatmentCycleId);
        }
        const cycleKind = input.cycleKind ||
            (input.therapistId ? TreatmentCycleKind.SUPERVISION : TreatmentCycleKind.CLINICAL);
        if (cycleKind === TreatmentCycleKind.CLINICAL && !input.patientId) {
            throw new BadRequestException('Clinical cycle finalization requires patientId');
        }
        if (cycleKind === TreatmentCycleKind.SUPERVISION && !input.therapistId) {
            throw new BadRequestException('Supervision cycle finalization requires therapistId');
        }
        const cycle = await this.getActiveCycle({
            cycleKind,
            patientId: input.patientId,
            therapistId: input.therapistId,
        });
        if (!cycle) throw new NotFoundException('Active treatment cycle not found');
        return cycle;
    }

    private async resolvePreviousCycleForNewTreatment(
        input: StartNewTreatmentCycleInput,
    ): Promise<TreatmentCycle> {
        if (input.previousTreatmentCycleId) {
            const cycle = await this.getCycle(input.previousTreatmentCycleId);
            if (cycle.status !== TreatmentCycleStatus.FINALIZED) {
                throw new BadRequestException('New treatment must start from a finalized cycle');
            }
            return cycle;
        }

        const cycleKind = input.cycleKind ||
            (input.therapistId ? TreatmentCycleKind.SUPERVISION : TreatmentCycleKind.CLINICAL);
        if (cycleKind === TreatmentCycleKind.CLINICAL && !input.patientId) {
            throw new BadRequestException('New clinical cycle requires patientId');
        }
        if (cycleKind === TreatmentCycleKind.SUPERVISION && !input.therapistId) {
            throw new BadRequestException('New supervision cycle requires therapistId');
        }

        const cycles = await this.listCycles({
            cycleKind,
            patientId: input.patientId,
            therapistId: input.therapistId,
        });
        const finalizedCycles = cycles.filter(cycle =>
            cycle.status === TreatmentCycleStatus.FINALIZED,
        );
        const previousCycle = finalizedCycles[0];
        if (!previousCycle) throw new NotFoundException('Finalized treatment cycle not found');
        return previousCycle;
    }

    private async assertFinalizationReason(
        reasonId: number | undefined,
        cycleKind: TreatmentCycleKind,
    ): Promise<void> {
        if (!reasonId) return;
        const reason = await this.reasonRepository.findOne(reasonId);
        if (!reason) throw new BadRequestException('Finalization reason was not found');
        const expectedContext = cycleKind === TreatmentCycleKind.SUPERVISION
            ? CaseEventReasonContext.SUPERVISION_FINALIZATION
            : CaseEventReasonContext.TREATMENT_FINALIZATION;
        if (reason.context !== expectedContext) {
            throw new BadRequestException('Reason does not belong to treatment finalization');
        }
    }

    private async assertNewTreatmentReason(
        reasonId: number | undefined,
        cycleKind: TreatmentCycleKind,
    ): Promise<void> {
        if (!reasonId) return;
        const reason = await this.reasonRepository.findOne(reasonId);
        if (!reason) throw new BadRequestException('New treatment reason was not found');
        const expectedContext = cycleKind === TreatmentCycleKind.SUPERVISION
            ? CaseEventReasonContext.NEW_SUPERVISION
            : CaseEventReasonContext.NEW_TREATMENT;
        if (reason.context !== expectedContext) {
            throw new BadRequestException('Reason does not belong to new treatment');
        }
    }

    private createHistoryEntry(input: {
        entryKind: CaseHistoryEntryKind;
        cycle: TreatmentCycle;
        occurredAt: Date;
        title: string;
        content?: string;
        reasonSnapshot?: string;
        sessionNumber?: number;
        clinicalSessionId?: number;
        metadata?: any;
    }): Promise<CaseHistoryEntry> {
        return this.historyEntryRepository.save(
            this.historyEntryRepository.create({
                entryKind: input.entryKind,
                cycleKind: input.cycle.cycleKind,
                patientId: input.cycle.patientId,
                therapistId: input.cycle.therapistId,
                treatmentCycleId: input.cycle.id,
                clinicalSessionId: input.clinicalSessionId,
                sessionNumber: input.sessionNumber,
                occurredAt: input.occurredAt,
                title: input.title,
                content: input.content,
                reasonSnapshot: input.reasonSnapshot,
                metadata: input.metadata,
            }),
        );
    }

    private async getCycleSessions(cycleId: number): Promise<ClinicalSession[]> {
        return this.sessionRepository.find({
            where: { treatmentCycleId: cycleId },
            relations: [
                'calendarOccurrence',
                'resources',
                'resources.assessment',
            ],
            order: { sessionNumber: 'ASC', id: 'ASC' },
        });
    }

    private resolveLastSessionForFinalization(
        sessions: ClinicalSession[],
        finalizedAt: Date,
        requestedSessionNumber?: number,
    ): ClinicalSession | undefined {
        const activeSessions = sessions
            .filter(session => session.clinicalStatus !== ClinicalSessionStatus.CANCELLED)
            .sort((left, right) => this.sessionStartTime(left) - this.sessionStartTime(right));
        if (!activeSessions.length) return undefined;

        if (requestedSessionNumber) {
            const session = activeSessions.find(candidate =>
                candidate.sessionNumber === requestedSessionNumber,
            );
            if (!session) {
                throw new BadRequestException('Last session number does not exist in this cycle');
            }
            return session;
        }

        const beforeFinalization = activeSessions.filter(session =>
            this.sessionStartTime(session) <= finalizedAt.getTime(),
        );
        return beforeFinalization[beforeFinalization.length - 1];
    }

    private async getFutureCycleAssessments(
        cycleId: number,
        finalizedAt: Date,
    ): Promise<Assessment[]> {
        return this.assessmentRepository
            .createQueryBuilder('assessment')
            .where('assessment."treatmentCycleId" = :cycleId', { cycleId })
            .andWhere('assessment."clinicalSessionId" IS NULL')
            .andWhere('(assessment.deleted IS NULL OR assessment.deleted = false)')
            .andWhere('assessment.status != :cancelledStatus', {
                cancelledStatus: AssessmentStatus.CANCELLED,
            })
            .andWhere('assessment."deliveryDate" > :finalizedAt', { finalizedAt })
            .getMany();
    }

    private async cancelFutureWorkForFinalization(
        sessions: ClinicalSession[],
        assessments: Assessment[],
        finalizationReasonId?: number,
    ): Promise<FinalizationSnapshot> {
        const reasonSnapshot = await this.reasonService.reasonPathSnapshot(finalizationReasonId);
        const snapshot: FinalizationSnapshot = {
            cancelledSessions: [],
            cancelledAssessments: [],
            deletedInactiveSessionIds: [],
        };

        for (const session of sessions) {
            snapshot.cancelledSessions.push({
                id: session.id,
                sessionNumber: session.sessionNumber,
                clinicalStatus: session.clinicalStatus,
                cancellationType: session.cancellationType,
                cancellationLabel: session.cancellationLabel,
                cancellationReasonId: session.cancellationReasonId,
                cancellationReasonSnapshot: session.cancellationReasonSnapshot,
                cancellationComment: session.cancellationComment,
                cancelledAt: session.cancelledAt,
                cancelledSessionNumber: session.cancelledSessionNumber,
                cancelledStartAt: session.cancelledStartAt,
                occurrenceId: session.calendarOccurrenceId,
                occurrenceStatus: session.calendarOccurrence?.status,
                occurrenceCancellationReason: session.calendarOccurrence?.cancellationReason,
            });
            session.cancelledAt = new Date();
            session.cancelledSessionNumber = session.sessionNumber;
            session.cancelledStartAt = session.calendarOccurrence?.startAt;
            session.cancellationType = ClinicalSessionCancellationType.RESCHEDULED;
            session.cancellationLabel = ClinicalSessionCancellationLabel.CANCELLED;
            session.cancellationReasonId = finalizationReasonId;
            session.cancellationReasonSnapshot = reasonSnapshot;
            session.cancellationComment = 'Finalizacion de tratamiento/supervision';
            session.clinicalStatus = ClinicalSessionStatus.CANCELLED;
            await this.sessionRepository.save(session);

            if (session.calendarOccurrence) {
                session.calendarOccurrence.status = CalendarOccurrenceStatus.CANCELLED;
                session.calendarOccurrence.cancellationReason = reasonSnapshot;
                await this.occurrenceRepository.save(session.calendarOccurrence);
            }

            for (const resource of session.resources || []) {
                if (resource.assessment) assessments.push(resource.assessment);
            }
        }

        for (const assessment of this.uniqueAssessments(assessments)) {
            if (this.assessmentHasActivity(assessment)) continue;
            snapshot.cancelledAssessments.push({
                id: assessment.id,
                status: assessment.status,
            });
            assessment.status = AssessmentStatus.CANCELLED;
            await this.assessmentRepository.save(assessment);
        }

        return snapshot;
    }

    private async restoreFinalizationSnapshot(snapshot?: FinalizationSnapshot): Promise<void> {
        if (!snapshot) return;

        for (const sessionSnapshot of snapshot.cancelledSessions || []) {
            const session = await this.sessionRepository.findOne(sessionSnapshot.id, {
                relations: ['calendarOccurrence'],
            });
            if (!session) continue;
            session.sessionNumber = sessionSnapshot.sessionNumber;
            session.clinicalStatus = sessionSnapshot.clinicalStatus;
            session.cancellationType = sessionSnapshot.cancellationType;
            session.cancellationLabel = sessionSnapshot.cancellationLabel;
            session.cancellationReasonId = sessionSnapshot.cancellationReasonId;
            session.cancellationReasonSnapshot = sessionSnapshot.cancellationReasonSnapshot;
            session.cancellationComment = sessionSnapshot.cancellationComment;
            session.cancelledAt = sessionSnapshot.cancelledAt;
            session.cancelledSessionNumber = sessionSnapshot.cancelledSessionNumber;
            session.cancelledStartAt = sessionSnapshot.cancelledStartAt;
            await this.sessionRepository.save(session);

            if (session.calendarOccurrence) {
                session.calendarOccurrence.status =
                    sessionSnapshot.occurrenceStatus || CalendarOccurrenceStatus.SCHEDULED;
                session.calendarOccurrence.cancellationReason =
                    sessionSnapshot.occurrenceCancellationReason;
                await this.occurrenceRepository.save(session.calendarOccurrence);
            }
        }

        for (const assessmentSnapshot of snapshot.cancelledAssessments || []) {
            const assessment = await this.assessmentRepository.findOne(assessmentSnapshot.id);
            if (!assessment) continue;
            assessment.status = assessmentSnapshot.status;
            await this.assessmentRepository.save(assessment);
        }
    }

    private async deleteInactiveSessionWithoutRecord(session: ClinicalSession): Promise<void> {
        const resources = session.resources || await this.resourceRepository.find({
            where: { clinicalSessionId: session.id },
            relations: ['assessment'],
        });
        for (const resource of resources) {
            if (resource.assessmentId) {
                await this.assessmentRepository.delete(resource.assessmentId);
            }
            await this.resourceRepository.delete(resource.id);
        }
        await this.sessionRepository.delete(session.id);
        if (session.calendarOccurrenceId) {
            await this.occurrenceRepository.delete(session.calendarOccurrenceId);
        }
    }

    private sessionHasActivity(session: ClinicalSession): boolean {
        if ((session.clinicalHistory || '').trim()) return true;
        return (session.resources || []).some(resource =>
            resource.assessment && this.assessmentHasActivity(resource.assessment),
        );
    }

    private assessmentHasActivity(assessment: Assessment): boolean {
        return (
            !!assessment.submissionDate ||
            [
                AssessmentStatus.COMPLETED,
                AssessmentStatus.PARTIALLY_COMPLETED,
            ].includes(assessment.status as AssessmentStatus)
        );
    }

    private sessionStartTime(session: ClinicalSession): number {
        return session.calendarOccurrence?.startAt
            ? new Date(session.calendarOccurrence.startAt).getTime()
            : 0;
    }

    private async assertCanManageCycle(
        cycle: TreatmentCycle,
        currentUser?: User,
    ): Promise<void> {
        if (!currentUser) return;
        if (await this.userHasPermission(currentUser.id, PermissionEnum.ASSESSMENTS_EDIT_ALL)) {
            return;
        }
        if (
            await this.userHasPermission(
                currentUser.id,
                PermissionEnum.CLINICAL_EDIT_DEPARTMENT,
            ) &&
            await this.userSharesCycleDepartment(cycle, currentUser.id)
        ) {
            return;
        }
        if (cycle.cycleKind === TreatmentCycleKind.CLINICAL && cycle.patientId) {
            const patient = await this.patientRepository.findOne(cycle.patientId, {
                relations: ['caseManagers'],
            });
            if (patient?.caseManagers?.some(user => user.id === currentUser.id)) return;
        }
        if (cycle.cycleKind === TreatmentCycleKind.SUPERVISION && cycle.therapistId) {
            const supervisorIds = await this.supervisorIdsForTherapist(cycle.therapistId);
            if (supervisorIds.includes(currentUser.id)) return;
        }

        throw new BadRequestException('You do not have permission to manage this cycle');
    }

    private async userSharesCycleDepartment(
        cycle: TreatmentCycle,
        userId: number,
    ): Promise<boolean> {
        const [manager, patient, therapist] = await Promise.all([
            this.userRepository.findOne({
                where: { id: userId },
                relations: ['departments'],
            }),
            cycle.patientId
                ? this.patientRepository.findOne(cycle.patientId, { relations: ['departments'] })
                : Promise.resolve(undefined),
            cycle.therapistId
                ? this.userRepository.findOne({
                    where: { id: cycle.therapistId },
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

    private uniqueSessions(sessions: ClinicalSession[]): ClinicalSession[] {
        const byId = new Map<number, ClinicalSession>();
        for (const session of sessions) {
            if (session?.id) byId.set(session.id, session);
        }
        return [...byId.values()];
    }

    private uniqueAssessments(assessments: Assessment[]): Assessment[] {
        const byId = new Map<number, Assessment>();
        for (const assessment of assessments) {
            if (assessment?.id) byId.set(assessment.id, assessment);
        }
        return [...byId.values()];
    }

    private addDays(date: Date, days: number): Date {
        const next = new Date(date);
        next.setDate(next.getDate() + days);
        return next;
    }
}
