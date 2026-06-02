import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateFullAssessmentInput } from 'src/modules/assessment/dtos/create-assessment.input';
import { AssessmentInformant } from 'src/modules/assessment/enums/assessment-informant.enum';
import { AssessmentService } from 'src/modules/assessment/services/assessment.service';
import { ApplyEvaluationSchemeInput } from 'src/modules/evaluation-scheme/dtos/evaluation-scheme-generation.input';
import { SchemeGenerationService } from 'src/modules/evaluation-scheme/services/scheme-generation.service';
import { Patient } from 'src/modules/patient/models/patient.model';
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
        const context = await this.buildUserContext(input.userId);
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
                input.triggerPoint,
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

        const context = await this.buildUserContext(input.userId);
        const triggerEventId = this.resolveTriggerEventId(input);
        const evaluation = await this.evaluateAutomation(
            automation,
            context,
            input.triggerPoint,
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

    private async buildUserContext(userId: number): Promise<UserAutomationContext> {
        const user = await this.userRepository.findOne(userId, {
            relations: ['roles', 'departments'],
        });
        if (!user) throw new NotFoundException('User not found');

        const patient = await this.patientRepository.findOne({
            where: { userId: user.id },
            relations: ['departments', 'status', 'caseManagers'],
        });

        return {
            user,
            departmentIds: (user.departments || []).map(department => department.id),
            roleIds: (user.roles || []).map(role => role.id),
            patient,
        };
    }

    private async evaluateAutomation(
        automation: EvaluationAutomation,
        context: UserAutomationContext,
        triggerPoint: EvaluationAutomationTriggerPoint,
        triggerEventId: string,
    ): Promise<EvaluationResult> {
        const unmetReasons: string[] = [];

        if (!automation.active) unmetReasons.push('automation_inactive');
        if (automation.triggerPoint !== triggerPoint) unmetReasons.push('invalid_trigger_point');
        if (!context.roleIds.includes(automation.roleId)) unmetReasons.push('invalid_role');

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
            triggerPoint,
            triggerEventId,
        );

        return {
            applies: !unmetReasons.length && !duplicateDetected,
            duplicateDetected,
            scheduledAt: this.calculateScheduledAt(automation),
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
                automation.delayUnit !== EvaluationAutomationDelayUnit.DAYS)
        ) {
            throw new BadRequestException('Fixed scheme automation is invalid');
        }

        if (
            automation.automationType ===
            EvaluationAutomationType.INDIVIDUAL_EVALUATION
        ) {
            if (
                !automation.assessmentTypeId ||
                automation.delayUnit !== EvaluationAutomationDelayUnit.MINUTES ||
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
                    ...(execution?.metadata || {}),
                    scheduledAt: execution?.scheduledAt?.toISOString(),
                },
            }),
        );
    }

    private resolveTriggerEventId(input: EvaluationAutomationTriggerInput): string {
        if (input.triggerEventId) return input.triggerEventId;
        return `${input.triggerPoint}:user:${input.userId}`;
    }

    private calculateScheduledAt(automation: EvaluationAutomation): Date {
        const now = new Date();
        if (automation.delayUnit === EvaluationAutomationDelayUnit.DAYS) {
            const result = new Date(now);
            result.setDate(result.getDate() + automation.delayAmount);
            return result;
        }
        return this.addMinutes(now, automation.delayAmount);
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
            },
            normalized.includes('.') ? normalized : `user.${normalized}`,
        );
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
