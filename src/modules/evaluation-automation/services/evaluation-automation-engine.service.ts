import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateFullAssessmentInput } from 'src/modules/assessment/dtos/create-assessment.input';
import { AssessmentInformant } from 'src/modules/assessment/enums/assessment-informant.enum';
import { AssessmentService } from 'src/modules/assessment/services/assessment.service';
import { ApplyEvaluationSchemeInput } from 'src/modules/evaluation-scheme/dtos/evaluation-scheme-generation.input';
import { SchemeGenerationService } from 'src/modules/evaluation-scheme/services/scheme-generation.service';
import { Patient } from 'src/modules/patient/models/patient.model';
import { CaseEventReasonContext } from 'src/modules/treatment-cycle/enums/case-event-reason-context.enum';
import { User } from 'src/modules/user/models/user.model';
import { Repository } from 'typeorm';
import { EvaluationAutomationConditionDto } from '../dtos/evaluation-automation-condition.dto';
import { EvaluationAutomationConditionOperator } from '../enums/evaluation-automation-condition-operator.enum';
import { EvaluationAutomationDelayUnit } from '../enums/evaluation-automation-delay-unit.enum';
import { EvaluationAutomationResourceType } from '../enums/evaluation-automation-resource-type.enum';
import { EvaluationAutomationRunReason } from '../enums/evaluation-automation-run-reason.enum';
import { EvaluationAutomationRunStatus } from '../enums/evaluation-automation-run-status.enum';
import { EvaluationAutomationTriggerPoint } from '../enums/evaluation-automation-trigger-point.enum';
import { EvaluationAutomationType } from '../enums/evaluation-automation-type.enum';
import { EvaluationAutomationRun } from '../models/evaluation-automation-run.model';
import { EvaluationAutomation } from '../models/evaluation-automation.model';

export interface EvaluationAutomationTriggerInput {
    triggerPoint: EvaluationAutomationTriggerPoint;
    userId: number;
    patientId?: number;
    therapistId?: number;
    treatmentCycleId?: number;
    clinicalSessionId?: number;
    sessionNumber?: number;
    reasonId?: number;
    reasonIds?: number[];
    reasonContext?: CaseEventReasonContext;
    reasonContexts?: CaseEventReasonContext[];
    triggerOccurredAt?: Date;
    metadata?: Record<string, any>;
    triggerEventId?: string;
    excludedAutomationIds?: number[];
}

export interface EvaluationAutomationSimulationResult {
    automationId: number;
    applies: boolean;
    duplicateDetected: boolean;
    resourceType?: EvaluationAutomationResourceType;
    scheduledAt?: Date;
    unmetReasons: string[];
    conditionResults: Array<{
        condition: EvaluationAutomationConditionDto;
        passed: boolean;
        actualValue?: any;
    }>;
}

interface UserAutomationContext {
    user: User;
    departmentIds: number[];
    roleIds: number[];
    patient?: Patient;
    trigger: EvaluationAutomationTriggerInput;
}

interface EvaluationResult {
    applies: boolean;
    duplicateDetected: boolean;
    scheduledAt?: Date;
    unmetReasons: string[];
    conditionResults: Array<{
        condition: EvaluationAutomationConditionDto;
        passed: boolean;
        actualValue?: any;
    }>;
}

interface ExecutionResult {
    resourceType: EvaluationAutomationResourceType;
    resourceId: number;
    scheduledAt: Date;
    metadata?: Record<string, any>;
}

@Injectable()
export class EvaluationAutomationEngineService {
    constructor(
        @InjectRepository(EvaluationAutomation)
        private readonly automationRepository: Repository<EvaluationAutomation>,
        @InjectRepository(EvaluationAutomationRun)
        private readonly runRepository: Repository<EvaluationAutomationRun>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Patient)
        private readonly patientRepository: Repository<Patient>,
        private readonly schemeGenerationService: SchemeGenerationService,
        private readonly assessmentService: AssessmentService,
    ) {}

    async handleTrigger(
        input: EvaluationAutomationTriggerInput,
    ): Promise<EvaluationAutomationRun[]> {
        const context = await this.buildUserContext(input);
        const triggerEventId = this.resolveTriggerEventId(input);
        const automations = await this.findActiveAutomations(input.triggerPoint);
        const excludedAutomationIds = input.excludedAutomationIds || [];
        const runs: EvaluationAutomationRun[] = [];

        for (const automation of automations) {
            if (excludedAutomationIds.includes(automation.id)) {
                continue;
            }

            const evaluation = await this.evaluateAutomation(
                automation,
                context,
                triggerEventId,
            );

            if (!evaluation.applies || evaluation.duplicateDetected) {
                continue;
            }

            try {
                const execution = await this.executeAutomation(
                    automation,
                    context,
                    evaluation.scheduledAt,
                );
                runs.push(
                    await this.recordRun(
                        automation,
                        context.user.id,
                        input.triggerPoint,
                        triggerEventId,
                        EvaluationAutomationRunStatus.EXECUTED,
                        execution,
                        undefined,
                        undefined,
                        input.metadata,
                    ),
                );
            } catch (error) {
                runs.push(
                    await this.recordRun(
                        automation,
                        context.user.id,
                        input.triggerPoint,
                        triggerEventId,
                        EvaluationAutomationRunStatus.FAILED,
                        null,
                        EvaluationAutomationRunReason.EXECUTION_ERROR,
                        error?.message || 'Automation execution failed',
                        input.metadata,
                    ),
                );
            }
        }

        return runs;
    }

    async simulateAutomation(
        automationId: number,
        input: EvaluationAutomationTriggerInput,
    ): Promise<EvaluationAutomationSimulationResult> {
        const automation = await this.automationRepository.findOne(automationId, {
            relations: ['departments', 'role'],
        });
        if (!automation) throw new NotFoundException('Automation not found');

        const context = await this.buildUserContext(input);
        const triggerEventId = this.resolveTriggerEventId(input);
        const evaluation = await this.evaluateAutomation(
            automation,
            context,
            triggerEventId,
        );

        return {
            automationId,
            applies: evaluation.applies,
            duplicateDetected: evaluation.duplicateDetected,
            resourceType: this.resourceTypeForAutomation(automation),
            scheduledAt: evaluation.scheduledAt,
            unmetReasons: evaluation.unmetReasons,
            conditionResults: evaluation.conditionResults,
        };
    }

    private async findActiveAutomations(
        triggerPoint: EvaluationAutomationTriggerPoint,
    ): Promise<EvaluationAutomation[]> {
        return this.automationRepository.find({
            where: { triggerPoint, active: true },
            relations: ['departments', 'role'],
            order: { priority: 'ASC', id: 'ASC' },
        });
    }

    private async buildUserContext(input: EvaluationAutomationTriggerInput): Promise<UserAutomationContext> {
        const user = await this.userRepository.findOne(input.userId, {
            relations: ['roles', 'departments'],
        });
        if (!user) throw new NotFoundException('User not found');

        const patient = input.patientId
            ? await this.patientRepository.findOne(input.patientId, {
                relations: ['departments', 'status', 'caseManagers'],
            })
            : await this.patientRepository.findOne({
                where: { userId: user.id },
                relations: ['departments', 'status', 'caseManagers'],
            });

        return {
            user,
            departmentIds: patient?.departments?.length
                ? patient.departments.map(department => department.id)
                : (user.departments || []).map(department => department.id),
            roleIds: (user.roles || []).map(role => role.id),
            patient,
            trigger: input,
        };
    }

    private async evaluateAutomation(
        automation: EvaluationAutomation,
        context: UserAutomationContext,
        triggerEventId: string,
    ): Promise<EvaluationResult> {
        const unmetReasons: string[] = [];

        if (!automation.active) unmetReasons.push('automation_inactive');
        if (automation.triggerPoint !== context.trigger.triggerPoint) unmetReasons.push('invalid_trigger_point');
        if (!context.roleIds.includes(automation.roleId)) unmetReasons.push('invalid_role');
        if (
            automation.triggerPoint === EvaluationAutomationTriggerPoint.SESSION_NUMBER &&
            Number(automation.triggerSessionNumber) !== Number(context.trigger.sessionNumber)
        ) {
            unmetReasons.push('invalid_session_number');
        }
        if (!this.reasonFilterMatches(automation, context.trigger)) {
            unmetReasons.push('invalid_reason');
        }
        if (!this.lastLoginInactiveDaysMatches(automation, context.trigger)) {
            unmetReasons.push('invalid_last_login_inactivity');
        }

        const automationDepartmentIds = (automation.departments || []).map(
            department => department.id,
        );
        if (
            automationDepartmentIds.length &&
            !automationDepartmentIds.some(id => context.departmentIds.includes(id))
        ) {
            unmetReasons.push('invalid_department');
        }

        const conditionResults = (automation.conditions || []).map(condition => {
            const actualValue = this.resolveConditionValue(condition.field, context);
            return {
                condition,
                actualValue,
                passed: this.evaluateCondition(condition, actualValue),
            };
        });
        if (conditionResults.some(result => !result.passed)) {
            unmetReasons.push('conditions_not_met');
        }

        const duplicateDetected = await this.hasDuplicateRun(
            automation.id,
            context.user.id,
            context.trigger.triggerPoint,
            triggerEventId,
        );

        return {
            applies: !unmetReasons.length && !duplicateDetected,
            duplicateDetected,
            scheduledAt: this.calculateScheduledAt(automation, context.trigger.triggerOccurredAt),
            unmetReasons,
            conditionResults,
        };
    }

    private async executeAutomation(
        automation: EvaluationAutomation,
        context: UserAutomationContext,
        scheduledAt: Date,
    ): Promise<ExecutionResult> {
        this.validateExecutableAutomation(automation);

        if (automation.automationType === EvaluationAutomationType.FIXED_SCHEME) {
            const assignment = await this.schemeGenerationService.applyScheme(
                this.buildSchemeAssignmentInput(automation, context, scheduledAt),
            );
            return {
                resourceType:
                    EvaluationAutomationResourceType.EVALUATION_SCHEME_ASSIGNMENT,
                resourceId: assignment.id,
                scheduledAt,
                metadata: { schemeId: automation.schemeId },
            };
        }

        const assessment = await this.assessmentService.createNewAssessment(
            this.buildAssessmentInput(automation, context, scheduledAt),
        );
        return {
            resourceType: EvaluationAutomationResourceType.ASSESSMENT,
            resourceId: assessment.id,
            scheduledAt,
            metadata: {
                assessmentTypeId: automation.assessmentTypeId,
                questionnaireIds: automation.questionnaireIds || [],
                questionnaireBundleIds: automation.questionnaireBundleIds || [],
                randomizationRuleIds: automation.randomizationRuleIds || [],
            },
        };
    }

    private buildSchemeAssignmentInput(
        automation: EvaluationAutomation,
        context: UserAutomationContext,
        scheduledAt: Date,
    ): ApplyEvaluationSchemeInput {
        return {
            schemeId: automation.schemeId,
            patientId: context.patient?.id,
            targetUserId: context.user.id,
            responderUserId: context.user.id,
            clinicianId: this.resolveClinicianId(context),
            startDate: scheduledAt,
            timezone: 'UTC',
        };
    }

    private buildAssessmentInput(
        automation: EvaluationAutomation,
        context: UserAutomationContext,
        scheduledAt: Date,
    ): CreateFullAssessmentInput {
        const expirationDate = this.resolveExpirationDate(automation, scheduledAt);

        return ({
            assessmentTypeId: automation.assessmentTypeId,
            patientId: context.patient?.id,
            targetUserId: context.user.id,
            responderUserId: context.user.id,
            clinicianId: this.resolveClinicianId(context),
            informantType: AssessmentInformant.PATIENT,
            note: automation.evaluationName,
            questionnaires: automation.questionnaireIds || [],
            questionnaireBundles: automation.questionnaireBundleIds || [],
            randomizationRuleIds: automation.randomizationRuleIds || [],
            dates: [
                {
                    deliveryDate: scheduledAt,
                    expirationDate,
                    reminderMinutes: automation.reminderMinutes || [],
                },
            ],
            emailReminder: automation.emailNotificationsEnabled,
            mailTemplateId: automation.emailNotificationsEnabled
                ? automation.mailTemplateId
                : null,
            receiverEmail: context.user.email,
        } as unknown) as CreateFullAssessmentInput;
    }

    private resolveExpirationDate(
        automation: EvaluationAutomation,
        scheduledAt: Date,
    ): Date | null {
        if (automation.expirationMinutes === undefined || automation.expirationMinutes === null) {
            return null;
        }

        return this.addMinutes(scheduledAt, automation.expirationMinutes);
    }

    private validateExecutableAutomation(automation: EvaluationAutomation): void {
        if (automation.delayAmount < 0) {
            throw new BadRequestException('Delay must be greater than or equal to zero');
        }

        if (
            automation.automationType === EvaluationAutomationType.FIXED_SCHEME &&
            (!automation.schemeId ||
                !this.isSupportedDelayUnit(automation.delayUnit))
        ) {
            throw new BadRequestException('Fixed scheme automation is invalid');
        }

        if (
            automation.automationType ===
            EvaluationAutomationType.INDIVIDUAL_EVALUATION
        ) {
            if (
                !automation.assessmentTypeId ||
                !this.isSupportedDelayUnit(automation.delayUnit) ||
                !this.hasEvaluationContent(automation)
            ) {
                throw new BadRequestException('Individual evaluation automation is invalid');
            }

            if (automation.emailNotificationsEnabled && !automation.mailTemplateId) {
                throw new BadRequestException('Mail template is required');
            }
        }
    }

    private hasEvaluationContent(automation: EvaluationAutomation): boolean {
        const selected =
            (automation.questionnaireIds?.length || 0) +
            (automation.questionnaireBundleIds?.length || 0) +
            (automation.randomizationRuleIds?.length || 0);
        return selected === 1;
    }

    private resourceTypeForAutomation(
        automation: EvaluationAutomation,
    ): EvaluationAutomationResourceType {
        return automation.automationType === EvaluationAutomationType.FIXED_SCHEME
            ? EvaluationAutomationResourceType.EVALUATION_SCHEME_ASSIGNMENT
            : EvaluationAutomationResourceType.ASSESSMENT;
    }

    private resolveClinicianId(context: UserAutomationContext): number {
        const firstCaseManager = context.patient?.caseManagers?.[0];
        return firstCaseManager?.id || context.user.id;
    }

    private async hasDuplicateRun(
        automationId: number,
        userId: number,
        triggerPoint: EvaluationAutomationTriggerPoint,
        triggerEventId: string,
    ): Promise<boolean> {
        const count = await this.runRepository.count({
            where: {
                automationId,
                userId,
                triggerPoint,
                triggerEventId,
            },
        });
        return count > 0;
    }

    private async recordRun(
        automation: EvaluationAutomation,
        userId: number,
        triggerPoint: EvaluationAutomationTriggerPoint,
        triggerEventId: string,
        status: EvaluationAutomationRunStatus,
        execution?: ExecutionResult,
        reason?: EvaluationAutomationRunReason,
        message?: string,
        triggerMetadata?: Record<string, any>,
    ): Promise<EvaluationAutomationRun> {
        return this.runRepository.save(
            this.runRepository.create({
                automationId: automation.id,
                automationTitle: automation.title,
                userId,
                triggerPoint,
                triggerEventId,
                status,
                reason,
                message,
                resourceType: execution?.resourceType,
                resourceId: execution?.resourceId,
                metadata: {
                    ...(triggerMetadata || {}),
                    ...(execution?.metadata || {}),
                    scheduledAt: execution?.scheduledAt?.toISOString(),
                },
            }),
        );
    }

    private resolveTriggerEventId(input: EvaluationAutomationTriggerInput): string {
        if (input.triggerEventId) return input.triggerEventId;
        const parts = [
            input.triggerPoint,
            `user:${input.userId}`,
            input.patientId ? `patient:${input.patientId}` : null,
            input.therapistId ? `therapist:${input.therapistId}` : null,
            input.treatmentCycleId ? `cycle:${input.treatmentCycleId}` : null,
            input.clinicalSessionId ? `session:${input.clinicalSessionId}` : null,
            input.sessionNumber ? `number:${input.sessionNumber}` : null,
            input.reasonId ? `reason:${input.reasonId}` : null,
        ].filter(Boolean);
        if (input.triggerPoint === EvaluationAutomationTriggerPoint.LAST_LOGIN) {
            parts.push(input.triggerOccurredAt ? input.triggerOccurredAt.toISOString() : new Date().toISOString());
        }
        return parts.join(':');
    }

    private calculateScheduledAt(
        automation: EvaluationAutomation,
        triggerOccurredAt?: Date,
    ): Date {
        const base = triggerOccurredAt ? new Date(triggerOccurredAt) : new Date();
        switch (automation.delayUnit) {
            case EvaluationAutomationDelayUnit.MINUTES:
                return this.addMinutes(base, automation.delayAmount);
            case EvaluationAutomationDelayUnit.HOURS:
                return this.addMinutes(base, automation.delayAmount * 60);
            case EvaluationAutomationDelayUnit.DAYS: {
                const result = new Date(base);
                result.setDate(result.getDate() + automation.delayAmount);
                return result;
            }
            case EvaluationAutomationDelayUnit.WEEKS: {
                const result = new Date(base);
                result.setDate(result.getDate() + automation.delayAmount * 7);
                return result;
            }
            case EvaluationAutomationDelayUnit.MONTHS: {
                const result = new Date(base);
                result.setMonth(result.getMonth() + automation.delayAmount);
                return result;
            }
            case EvaluationAutomationDelayUnit.YEARS: {
                const result = new Date(base);
                result.setFullYear(result.getFullYear() + automation.delayAmount);
                return result;
            }
            default:
                return base;
        }
    }

    private addMinutes(date: Date, minutes: number): Date {
        return new Date(date.getTime() + minutes * 60 * 1000);
    }

    private resolveConditionValue(
        field: string,
        context: UserAutomationContext,
    ): any {
        const normalized = (field || '').trim();
        const lower = normalized.toLowerCase();

        if (lower === 'edad' || lower === 'age') {
            return this.calculateAge(context.user.birthDate || context.patient?.birthDate);
        }
        if (lower === 'estado_tratamiento' || lower === 'patient_status') {
            return context.patient?.status?.name;
        }
        if (lower === 'terapeuta_id' || lower === 'case_manager_id') {
            return (context.patient?.caseManagers || []).map(user => user.id);
        }
        if (lower === 'cantidad_sesiones' || lower === 'session_count') {
            return null;
        }

        return this.readPath(
            {
                user: context.user,
                patient: context.patient,
                departments: context.departmentIds,
                roles: context.roleIds,
                trigger: context.trigger,
            },
            normalized.includes('.') ? normalized : `user.${normalized}`,
        );
    }

    private reasonFilterMatches(
        automation: EvaluationAutomation,
        trigger: EvaluationAutomationTriggerInput,
    ): boolean {
        const configuredIds = (automation.triggerReasonIds || [])
            .map(id => Number(id))
            .filter(id => Number.isFinite(id));
        const configuredContexts = (automation.triggerReasonContexts || [])
            .filter(Boolean);
        if (!configuredIds.length && !configuredContexts.length) return true;

        const triggerContexts = [
            trigger.reasonContext,
            ...(trigger.reasonContexts || []),
        ].filter(Boolean);
        if (
            configuredContexts.length &&
            !triggerContexts.some(context => configuredContexts.includes(context))
        ) {
            return false;
        }
        if (!configuredIds.length) return true;

        const triggerIds = [
            trigger.reasonId,
            ...(trigger.reasonIds || []),
        ]
            .map(id => Number(id))
            .filter(id => Number.isFinite(id));
        return triggerIds.some(id => configuredIds.includes(id));
    }

    private lastLoginInactiveDaysMatches(
        automation: EvaluationAutomation,
        trigger: EvaluationAutomationTriggerInput,
    ): boolean {
        if (automation.triggerPoint !== EvaluationAutomationTriggerPoint.LAST_LOGIN) return true;
        const minDays = Number(automation.lastLoginInactiveDays || 0);
        if (!minDays) return true;

        const previousValue = trigger.metadata?.previousLastLoginAt;
        if (!previousValue) return false;
        const previous = new Date(previousValue);
        if (Number.isNaN(previous.getTime())) return false;

        const occurredAt = trigger.triggerOccurredAt ? new Date(trigger.triggerOccurredAt) : new Date();
        const inactiveDays = (occurredAt.getTime() - previous.getTime()) / (24 * 60 * 60 * 1000);
        return inactiveDays >= minDays;
    }

    private isSupportedDelayUnit(unit: EvaluationAutomationDelayUnit): boolean {
        return Object.values(EvaluationAutomationDelayUnit).includes(unit);
    }

    private evaluateCondition(
        condition: EvaluationAutomationConditionDto,
        actualValue: any,
    ): boolean {
        const expectedValue = this.parseExpectedValue(condition.value);

        switch (condition.operator) {
            case EvaluationAutomationConditionOperator.EQ:
                return this.valueEquals(actualValue, expectedValue);
            case EvaluationAutomationConditionOperator.NEQ:
                return !this.valueEquals(actualValue, expectedValue);
            case EvaluationAutomationConditionOperator.GT:
                return Number(actualValue) > Number(expectedValue);
            case EvaluationAutomationConditionOperator.GTE:
                return Number(actualValue) >= Number(expectedValue);
            case EvaluationAutomationConditionOperator.LT:
                return Number(actualValue) < Number(expectedValue);
            case EvaluationAutomationConditionOperator.LTE:
                return Number(actualValue) <= Number(expectedValue);
            case EvaluationAutomationConditionOperator.CONTAINS:
                return this.valueContains(actualValue, expectedValue);
            case EvaluationAutomationConditionOperator.NOT_CONTAINS:
                return !this.valueContains(actualValue, expectedValue);
            case EvaluationAutomationConditionOperator.IS_EMPTY:
                return this.isEmpty(actualValue);
            case EvaluationAutomationConditionOperator.IS_NOT_EMPTY:
                return !this.isEmpty(actualValue);
            case EvaluationAutomationConditionOperator.BOOLEAN:
                return Boolean(actualValue) === Boolean(expectedValue);
            default:
                return false;
        }
    }

    private parseExpectedValue(value?: string): any {
        if (value === undefined || value === null) return null;
        const trimmed = `${value}`.trim();
        if (trimmed === 'true') return true;
        if (trimmed === 'false') return false;
        if (trimmed !== '' && !Number.isNaN(Number(trimmed))) return Number(trimmed);
        return trimmed;
    }

    private valueEquals(actualValue: any, expectedValue: any): boolean {
        if (Array.isArray(actualValue)) {
            return actualValue.some(value => this.valueEquals(value, expectedValue));
        }
        return `${actualValue}` === `${expectedValue}`;
    }

    private valueContains(actualValue: any, expectedValue: any): boolean {
        if (Array.isArray(actualValue)) {
            return actualValue.some(value => this.valueEquals(value, expectedValue));
        }
        return `${actualValue || ''}`.includes(`${expectedValue}`);
    }

    private isEmpty(value: any): boolean {
        if (value === undefined || value === null) return true;
        if (Array.isArray(value)) return value.length === 0;
        return `${value}`.trim() === '';
    }

    private calculateAge(birthDate?: Date): number {
        if (!birthDate) return null;
        const today = new Date();
        const birthday = new Date(birthDate);
        let age = today.getFullYear() - birthday.getFullYear();
        const monthDiff = today.getMonth() - birthday.getMonth();
        if (
            monthDiff < 0 ||
            (monthDiff === 0 && today.getDate() < birthday.getDate())
        ) {
            age -= 1;
        }
        return age;
    }

    private readPath(source: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            if (current === undefined || current === null) return undefined;
            return current[key];
        }, source);
    }
}
