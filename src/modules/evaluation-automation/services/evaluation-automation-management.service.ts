import { applyQuery } from '@nestjs-query/core';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRepository } from '@nestjs/typeorm';
import { Model, Types } from 'mongoose';
import { AssessmentType } from 'src/modules/assessment/models/assessment-type.model';
import { Department } from 'src/modules/department/models/department.model';
import { EvaluationSchemeType } from 'src/modules/evaluation-scheme/enums/evaluation-scheme-type.enum';
import { EvaluationScheme } from 'src/modules/evaluation-scheme/models/evaluation-scheme.model';
import { MailTemplate } from 'src/modules/mail/models/mail-template.model';
import { Role } from 'src/modules/permission/models/role.model';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { PermissionService } from 'src/modules/permission/providers/permission.service';
import { QuestionnaireBundle } from 'src/modules/questionnaire/models/questionnaire-bundle.schema';
import { Questionnaire } from 'src/modules/questionnaire/models/questionnaire.schema';
import { RandomizationRule } from 'src/modules/randomization/models/randomization-rule.model';
import { CaseEventReasonContext } from 'src/modules/treatment-cycle/enums/case-event-reason-context.enum';
import { CaseEventReason } from 'src/modules/treatment-cycle/models/case-event-reason.model';
import { User } from 'src/modules/user/models/user.model';
import { coversAllSelectedDepartments, uniqueDepartmentIds } from 'src/shared/department-compatibility';
import { In, Repository } from 'typeorm';
import { CreateEvaluationAutomationInput, UpdateEvaluationAutomationInput } from '../dtos/evaluation-automation.input';
import { EvaluationAutomationPreviewInput } from '../dtos/evaluation-automation-preview.input';
import { EvaluationAutomationPreviewResultDto } from '../dtos/evaluation-automation-preview-result.dto';
import { EvaluationAutomationTestResultDto } from '../dtos/evaluation-automation-test-result.dto';
import { TestEvaluationAutomationInput } from '../dtos/evaluation-automation-test.input';
import { EvaluationAutomationDelayUnit } from '../enums/evaluation-automation-delay-unit.enum';
import { EvaluationAutomationResourceType } from '../enums/evaluation-automation-resource-type.enum';
import { EvaluationAutomationTriggerPoint } from '../enums/evaluation-automation-trigger-point.enum';
import { EvaluationAutomationType } from '../enums/evaluation-automation-type.enum';
import { EvaluationAutomationRun } from '../models/evaluation-automation-run.model';
import { EvaluationAutomation } from '../models/evaluation-automation.model';
import { EvaluationAutomationEngineService } from './evaluation-automation-engine.service';

type AutomationInput = CreateEvaluationAutomationInput | UpdateEvaluationAutomationInput;

@Injectable()
export class EvaluationAutomationManagementService {
    private readonly automationRelations = [
        'departments',
        'role',
        'scheme',
        'assessmentType',
        'mailTemplate',
    ];

    constructor(
        @InjectRepository(EvaluationAutomation)
        private readonly automationRepository: Repository<EvaluationAutomation>,
        @InjectRepository(EvaluationAutomationRun)
        private readonly runRepository: Repository<EvaluationAutomationRun>,
        @InjectRepository(Department)
        private readonly departmentRepository: Repository<Department>,
        @InjectRepository(Role)
        private readonly roleRepository: Repository<Role>,
        @InjectRepository(EvaluationScheme)
        private readonly schemeRepository: Repository<EvaluationScheme>,
        @InjectRepository(AssessmentType)
        private readonly assessmentTypeRepository: Repository<AssessmentType>,
        @InjectRepository(RandomizationRule)
        private readonly randomizationRuleRepository: Repository<RandomizationRule>,
        @InjectRepository(MailTemplate)
        private readonly mailTemplateRepository: Repository<MailTemplate>,
        @InjectRepository(CaseEventReason)
        private readonly caseEventReasonRepository: Repository<CaseEventReason>,
        @InjectModel(Questionnaire.name)
        private readonly questionnaireModel: Model<Questionnaire>,
        @InjectModel(QuestionnaireBundle.name)
        private readonly questionnaireBundleModel: Model<QuestionnaireBundle>,
        private readonly engineService: EvaluationAutomationEngineService,
    ) {}

    async listAutomations(query: any, currentUser?: User): Promise<EvaluationAutomation[]> {
        const automations = await this.automationRepository.find({
            relations: this.automationRelations,
        });
        const permitted = await this.filterAutomationsByAccess(automations, currentUser);
        return applyQuery(permitted, query);
    }

    async getAutomationOrFail(id: number, currentUser?: User): Promise<EvaluationAutomation> {
        const automation = await this.automationRepository.findOne(id, {
            relations: this.automationRelations,
        });
        if (!automation) throw new NotFoundException('Automation not found');
        await this.assertCanAccessAutomation(automation, currentUser);
        return automation;
    }

    async listRuns(query: any, automationId?: number, currentUser?: User): Promise<EvaluationAutomationRun[]> {
        if (automationId) {
            await this.getAutomationOrFail(automationId, currentUser);
        }
        const runs = await this.runRepository.find({
            where: automationId ? { automationId } : {},
            relations: ['automation', 'automation.departments', 'user'],
        });
        const permittedAutomationIds = (await this.filterAutomationsByAccess(
            runs.map(run => run.automation).filter(Boolean) as EvaluationAutomation[],
            currentUser,
        )).map(automation => automation.id);
        const filteredRuns = automationId
            ? runs
            : runs.filter(run => !run.automationId || permittedAutomationIds.includes(run.automationId));
        return applyQuery(filteredRuns, query);
    }

    async previewAutomations(
        input: EvaluationAutomationPreviewInput,
        currentUser?: User,
    ): Promise<EvaluationAutomationPreviewResultDto[]> {
        const roleIds = await this.resolvePreviewRoleIds(input);
        const departmentIds = await this.permittedDepartmentIds(input.departmentIds || [], currentUser, false);
        const triggerPoints = input.triggerPoint
            ? [input.triggerPoint]
            : Object.values(EvaluationAutomationTriggerPoint);

        if (!roleIds.length || !departmentIds.length) {
            return [];
        }

        const automations = await this.automationRepository.find({
            where: { active: true },
            relations: this.automationRelations,
            order: { priority: 'ASC', id: 'ASC' },
        });

        const matchingAutomations = automations
            .filter(automation => triggerPoints.includes(automation.triggerPoint))
            .filter(automation => roleIds.includes(automation.roleId))
            .filter(automation => this.previewDepartmentMatches(automation, departmentIds));

        return Promise.all(
            matchingAutomations.map(automation => this.mapPreviewAutomation(automation)),
        );
    }

    async createAutomation(
        input: CreateEvaluationAutomationInput,
        currentUser?: User,
    ): Promise<EvaluationAutomation> {
        await this.assertCanManageDepartments(input.departmentIds, currentUser);
        await this.validateInput(input);

        const automation = await this.automationRepository.manager.transaction(
            async manager => {
                const created = await manager.save(
                    EvaluationAutomation,
                    manager.create(EvaluationAutomation, this.mapInput(input)),
                );

                await this.setDepartments(
                    created.id,
                    input.departmentIds,
                    manager.getRepository(Department),
                    manager.getRepository(EvaluationAutomation),
                );

                return created;
            },
        );

        return this.getAutomationOrFail(automation.id, currentUser);
    }

    async updateAutomation(
        input: UpdateEvaluationAutomationInput,
        currentUser?: User,
    ): Promise<EvaluationAutomation> {
        const current = await this.getAutomationOrFail(input.id, currentUser);
        const nextDepartmentIds = input.departmentIds === undefined
            ? current.departments?.map(department => department.id) || []
            : input.departmentIds;
        await this.assertCanManageDepartments(nextDepartmentIds, currentUser);
        await this.validateInput({ ...current, ...input, departmentIds: nextDepartmentIds });

        await this.automationRepository.manager.transaction(async manager => {
            const automation = await manager.findOne(EvaluationAutomation, input.id);
            if (!automation) throw new NotFoundException('Automation not found');

            Object.assign(automation, this.mapInput(input));
            await manager.save(EvaluationAutomation, automation);

            if (input.departmentIds !== undefined) {
                await this.setDepartments(
                    input.id,
                    input.departmentIds,
                    manager.getRepository(Department),
                    manager.getRepository(EvaluationAutomation),
                );
            }
        });

        return this.getAutomationOrFail(input.id, currentUser);
    }

    async duplicateAutomation(id: number, currentUser?: User): Promise<EvaluationAutomation> {
        const automation = await this.getAutomationOrFail(id, currentUser);
        return this.createAutomation({
            title: `${automation.title} copy`,
            description: automation.description,
            active: automation.active,
            departmentIds: automation.departments?.map(department => department.id) || [],
            roleId: automation.roleId,
            conditions: automation.conditions || [],
            triggerPoint: automation.triggerPoint,
            automationType: automation.automationType,
            triggerSessionNumber: automation.triggerSessionNumber,
            triggerReasonIds: automation.triggerReasonIds || [],
            lastLoginInactiveDays: automation.lastLoginInactiveDays,
            delayAmount: automation.delayAmount,
            delayUnit: automation.delayUnit,
            priority: automation.priority,
            schemeId: automation.schemeId,
            assessmentTypeId: automation.assessmentTypeId,
            questionnaireIds: automation.questionnaireIds || [],
            questionnaireBundleIds: automation.questionnaireBundleIds || [],
            randomizationRuleIds: automation.randomizationRuleIds || [],
            evaluationName: automation.evaluationName,
            expirationMinutes: automation.expirationMinutes,
            reminderMinutes: automation.reminderMinutes || [],
            emailNotificationsEnabled: automation.emailNotificationsEnabled,
            mailTemplateId: automation.mailTemplateId,
        }, currentUser);
    }

    async setActive(id: number, active: boolean, currentUser?: User): Promise<EvaluationAutomation> {
        const automation = await this.getAutomationOrFail(id, currentUser);
        if (!automation) throw new NotFoundException('Automation not found');
        await this.assertCanManageDepartments(
            automation.departments?.map(department => department.id) || [],
            currentUser,
        );
        automation.active = active;
        await this.automationRepository.save(automation);
        return this.getAutomationOrFail(id, currentUser);
    }

    async deleteAutomation(id: number, currentUser?: User): Promise<boolean> {
        const automation = await this.automationRepository.findOne(id, {
            relations: this.automationRelations,
        });
        if (!automation) return true;
        await this.assertCanAccessAutomation(automation, currentUser);
        await this.assertCanManageDepartments(
            automation.departments?.map(department => department.id) || [],
            currentUser,
        );
        await this.automationRepository.delete(id);
        return true;
    }

    async testAutomation(
        input: TestEvaluationAutomationInput,
        currentUser?: User,
    ): Promise<EvaluationAutomationTestResultDto> {
        await this.getAutomationOrFail(input.automationId, currentUser);
        const result = await this.engineService.simulateAutomation(
            input.automationId,
            {
                triggerPoint: input.triggerPoint,
                userId: input.userId,
                patientId: input.patientId,
                therapistId: input.therapistId,
                treatmentCycleId: input.treatmentCycleId,
                clinicalSessionId: input.clinicalSessionId,
                sessionNumber: input.sessionNumber,
                reasonId: input.reasonId,
                reasonIds: input.reasonIds,
                reasonContexts: input.reasonContexts,
                triggerOccurredAt: input.triggerOccurredAt,
                triggerEventId: input.triggerEventId,
            },
        );
        return EvaluationAutomationTestResultDto.fromResult(result);
    }

    private mapInput(input: Partial<AutomationInput>): Partial<EvaluationAutomation> {
        const mapped: Partial<EvaluationAutomation> = {};
        [
            'title',
            'description',
            'active',
            'roleId',
            'conditions',
            'triggerPoint',
            'automationType',
            'triggerSessionNumber',
            'triggerReasonIds',
            'triggerReasonContexts',
            'lastLoginInactiveDays',
            'delayAmount',
            'delayUnit',
            'priority',
            'schemeId',
            'assessmentTypeId',
            'questionnaireIds',
            'questionnaireBundleIds',
            'randomizationRuleIds',
            'evaluationName',
            'expirationMinutes',
            'reminderMinutes',
            'emailNotificationsEnabled',
            'mailTemplateId',
        ].forEach((key: string) => {
            const value = (input as any)[key];
            if (value !== undefined) {
                (mapped as any)[key] = value;
            }
        });
        return mapped;
    }

    private async validateInput(input: Partial<AutomationInput>): Promise<void> {
        if (!input.title || !input.title.trim()) {
            throw new BadRequestException('Title is required');
        }
        if (!input.departmentIds?.length) {
            throw new BadRequestException('At least one department is required');
        }
        if (!input.roleId) throw new BadRequestException('Role is required');
        if (!input.triggerPoint) throw new BadRequestException('Trigger point is required');
        if (!input.automationType) throw new BadRequestException('Automation type is required');
        if (
            input.triggerPoint === EvaluationAutomationTriggerPoint.SESSION_NUMBER &&
            (!input.triggerSessionNumber || input.triggerSessionNumber < 1)
        ) {
            throw new BadRequestException('Session number trigger requires a valid session number');
        }
        if (
            input.lastLoginInactiveDays !== undefined &&
            input.lastLoginInactiveDays !== null &&
            input.triggerPoint !== EvaluationAutomationTriggerPoint.LAST_LOGIN
        ) {
            throw new BadRequestException('Last login inactivity condition can only be used with last login trigger');
        }
        if (
            input.triggerPoint === EvaluationAutomationTriggerPoint.LAST_LOGIN &&
            input.lastLoginInactiveDays !== undefined &&
            input.lastLoginInactiveDays !== null &&
            input.lastLoginInactiveDays < 1
        ) {
            throw new BadRequestException('Last login inactivity days must be greater than zero');
        }
        if (input.delayAmount === undefined || input.delayAmount === null || input.delayAmount < 0) {
            throw new BadRequestException('Delay must be greater than or equal to zero');
        }
        if (!input.delayUnit) throw new BadRequestException('Delay unit is required');
        if (input.priority !== undefined && input.priority < 1) {
            throw new BadRequestException('Priority must be a positive integer');
        }

        const departmentIds = uniqueDepartmentIds(input.departmentIds);
        await this.validateDepartments(departmentIds);
        await this.validateTriggerReasons(input, departmentIds);
        await this.validateRole(input.roleId);
        await this.validateConditions(input);

        if (input.automationType === EvaluationAutomationType.FIXED_SCHEME) {
            await this.validateFixedSchemeInput(input, departmentIds);
        } else if (input.automationType === EvaluationAutomationType.INDIVIDUAL_EVALUATION) {
            await this.validateIndividualEvaluationInput(input, departmentIds);
        }
    }

    private async validateFixedSchemeInput(
        input: Partial<AutomationInput>,
        departmentIds: number[],
    ): Promise<void> {
        if (!input.schemeId) throw new BadRequestException('Fixed scheme is required');

        const scheme = await this.schemeRepository.findOne(input.schemeId, {
            relations: ['departments'],
        });
        if (!scheme) throw new NotFoundException('Evaluation scheme not found');
        if (scheme.schemeType !== EvaluationSchemeType.INDEPENDENT_EVALUATION) {
            throw new BadRequestException('Selected scheme must be a fixed scheme');
        }
        if (!coversAllSelectedDepartments(
            departmentIds,
            scheme.departments?.map(department => department.id) || [],
        )) {
            throw new BadRequestException('Scheme is not available for all selected departments');
        }
    }

    private async validateIndividualEvaluationInput(
        input: Partial<AutomationInput>,
        departmentIds: number[],
    ): Promise<void> {
        if (!input.assessmentTypeId) {
            throw new BadRequestException('Assessment type is required');
        }
        const assessmentType = await this.assessmentTypeRepository.findOne(input.assessmentTypeId);
        if (!assessmentType) throw new NotFoundException('Assessment type not found');

        const contentCount =
            (input.questionnaireIds?.length || 0) +
            (input.questionnaireBundleIds?.length || 0) +
            (input.randomizationRuleIds?.length || 0);
        if (contentCount !== 1) {
            throw new BadRequestException('Choose exactly one evaluation content resource');
        }

        if (input.expirationMinutes !== undefined && input.expirationMinutes <= 0) {
            throw new BadRequestException('Expiration time must be greater than zero');
        }
        if (input.reminderMinutes?.some(minute => minute < 0)) {
            throw new BadRequestException('Reminder minutes must be greater than or equal to zero');
        }
        if (input.emailNotificationsEnabled !== false && !input.mailTemplateId) {
            throw new BadRequestException('Mail template is required when email notifications are enabled');
        }
        if (input.mailTemplateId) {
            const mailTemplate = await this.mailTemplateRepository.findOne(input.mailTemplateId);
            if (!mailTemplate) throw new NotFoundException('Mail template not found');
        }

        await this.validateContentDepartments(input, departmentIds);
    }

    private async validateContentDepartments(
        input: Partial<AutomationInput>,
        departmentIds: number[],
    ): Promise<void> {
        if (input.questionnaireIds?.length) {
            const questionnaires = await this.questionnaireModel.find({
                _id: { $in: input.questionnaireIds.map(id => Types.ObjectId(id)) },
                zombie: { $ne: true },
            }).select('_id name departmentIds');
            if (questionnaires.length !== input.questionnaireIds.length) {
                throw new NotFoundException('Questionnaire not found');
            }
            const incompatible = questionnaires.find(questionnaire =>
                !coversAllSelectedDepartments(departmentIds, questionnaire.departmentIds),
            );
            if (incompatible) {
                throw new BadRequestException('Questionnaire is not available for all selected departments');
            }
        }

        if (input.questionnaireBundleIds?.length) {
            const bundles = await this.questionnaireBundleModel.find({
                _id: { $in: input.questionnaireBundleIds.map(id => Types.ObjectId(id)) },
                deleted: { $ne: true },
            }).select('_id name departmentIds');
            if (bundles.length !== input.questionnaireBundleIds.length) {
                throw new NotFoundException('Questionnaire bundle not found');
            }
            const incompatible = bundles.find(bundle =>
                !coversAllSelectedDepartments(departmentIds, bundle.departmentIds),
            );
            if (incompatible) {
                throw new BadRequestException('Questionnaire bundle is not available for all selected departments');
            }
        }

        if (input.randomizationRuleIds?.length) {
            const randomizations = await this.randomizationRuleRepository.find({
                where: { id: In(input.randomizationRuleIds) },
                relations: ['departments'],
            });
            if (randomizations.length !== input.randomizationRuleIds.length) {
                throw new NotFoundException('Randomization not found');
            }
            const incompatible = randomizations.find(randomization =>
                !coversAllSelectedDepartments(
                    departmentIds,
                    randomization.departments?.map(department => department.id) || [],
                ),
            );
            if (incompatible) {
                throw new BadRequestException('Randomization is not available for all selected departments');
            }
        }
    }

    private async validateDepartments(departmentIds: number[]): Promise<void> {
        const count = await this.departmentRepository.count({
            where: { id: In(departmentIds) },
        });
        if (count !== departmentIds.length) {
            throw new NotFoundException('One of the departments does not exist');
        }
    }

    private async validateTriggerReasons(
        input: Partial<AutomationInput>,
        departmentIds: number[],
    ): Promise<void> {
        const reasonIds = uniqueDepartmentIds(input.triggerReasonIds || []);
        const reasonContexts = this.uniqueReasonContexts(input.triggerReasonContexts || []);
        const expectedContexts = this.reasonContextsForTrigger(input.triggerPoint);

        if ((reasonIds.length || reasonContexts.length) && !expectedContexts.length) {
            throw new BadRequestException('Reason filters can only be used with reason-based triggers');
        }
        const invalidContext = reasonContexts.find(context => !expectedContexts.includes(context));
        if (invalidContext) {
            throw new BadRequestException('Reason context filters must match the selected trigger');
        }
        if (!reasonIds.length) return;

        const reasons = await this.caseEventReasonRepository.find({
            where: { id: In(reasonIds) },
        });
        if (reasons.length !== reasonIds.length) {
            throw new NotFoundException('One of the trigger reasons does not exist');
        }

        const invalidReason = reasons.find(reason =>
            !expectedContexts.includes(reason.context) ||
            (reasonContexts.length && !reasonContexts.includes(reason.context)) ||
            !reason.active ||
            (reason.departmentId && !departmentIds.includes(reason.departmentId)),
        );
        if (invalidReason) {
            throw new BadRequestException(
                'Trigger reasons must be active, match the selected trigger, and belong to one of the selected departments',
            );
        }
    }

    private uniqueReasonContexts(contexts: CaseEventReasonContext[]): CaseEventReasonContext[] {
        return Array.from(new Set((contexts || []).filter(Boolean)));
    }

    private reasonContextsForTrigger(
        triggerPoint?: EvaluationAutomationTriggerPoint,
    ): CaseEventReasonContext[] {
        switch (triggerPoint) {
            case EvaluationAutomationTriggerPoint.SESSION_NO_SHOW_CANCELLATION:
                return [
                    CaseEventReasonContext.SESSION_CANCELLATION,
                    CaseEventReasonContext.SUPERVISION_SESSION_CANCELLATION,
                ];
            case EvaluationAutomationTriggerPoint.TREATMENT_FINALIZATION:
                return [
                    CaseEventReasonContext.TREATMENT_FINALIZATION,
                    CaseEventReasonContext.SUPERVISION_FINALIZATION,
                ];
            case EvaluationAutomationTriggerPoint.NEW_TREATMENT:
                return [
                    CaseEventReasonContext.NEW_TREATMENT,
                    CaseEventReasonContext.NEW_SUPERVISION,
                ];
            default:
                return [];
        }
    }

    private async filterAutomationsByAccess(
        automations: EvaluationAutomation[],
        currentUser?: User,
    ): Promise<EvaluationAutomation[]> {
        if (!currentUser?.id || await this.hasAllAutomationAccess(currentUser.id)) {
            return automations;
        }
        const allowedDepartmentIds = await this.currentUserDepartmentIds(currentUser);
        return automations.filter(automation => {
            const automationDepartmentIds = automation.departments?.map(department => department.id) || [];
            return automationDepartmentIds.some(id => allowedDepartmentIds.includes(id));
        });
    }

    private async assertCanAccessAutomation(
        automation: EvaluationAutomation,
        currentUser?: User,
    ): Promise<void> {
        const permitted = await this.filterAutomationsByAccess([automation], currentUser);
        if (!permitted.length) {
            throw new ForbiddenException('Automation is outside your departments');
        }
    }

    private async assertCanManageDepartments(
        departmentIds: number[],
        currentUser?: User,
    ): Promise<void> {
        if (!currentUser?.id || await this.hasAllAutomationManageAccess(currentUser.id)) {
            return;
        }
        const allowedDepartmentIds = await this.currentUserDepartmentIds(currentUser);
        const outsideDepartments = uniqueDepartmentIds(departmentIds || [])
            .filter(id => !allowedDepartmentIds.includes(id));
        if (outsideDepartments.length) {
            throw new ForbiddenException('Automation includes departments you cannot manage');
        }
    }

    private async permittedDepartmentIds(
        requestedDepartmentIds: number[],
        currentUser?: User,
        requireNonEmpty = true,
    ): Promise<number[]> {
        if (!currentUser?.id || await this.hasAllAutomationAccess(currentUser.id)) {
            return requestedDepartmentIds;
        }
        const allowedDepartmentIds = await this.currentUserDepartmentIds(currentUser);
        const requestedIds = uniqueDepartmentIds(requestedDepartmentIds || []);
        const permitted = requestedIds.length
            ? requestedIds.filter(id => allowedDepartmentIds.includes(id))
            : allowedDepartmentIds;
        if (requireNonEmpty && !permitted.length) {
            throw new ForbiddenException('No permitted departments available');
        }
        return permitted;
    }

    private async hasAllAutomationAccess(userId: number): Promise<boolean> {
        return await PermissionService.userCan(
            userId,
            PermissionEnum.VIEW_ALL_EVALUATION_AUTOMATIONS,
        ) || await PermissionService.userCan(
            userId,
            PermissionEnum.MANAGE_ALL_EVALUATION_AUTOMATIONS,
        );
    }

    private async hasAllAutomationManageAccess(userId: number): Promise<boolean> {
        return PermissionService.userCan(
            userId,
            PermissionEnum.MANAGE_ALL_EVALUATION_AUTOMATIONS,
        );
    }

    private async currentUserDepartmentIds(currentUser: User): Promise<number[]> {
        const user = await User.findOne(currentUser.id, { relations: ['departments'] });
        return (user?.departments || []).map(department => department.id);
    }

    private async validateRole(roleId: number): Promise<void> {
        const role = await this.roleRepository.findOne(roleId);
        if (!role) throw new NotFoundException('Role not found');
    }

    private async validateConditions(input: Partial<AutomationInput>): Promise<void> {
        for (const condition of input.conditions || []) {
            if (!condition.field || !condition.operator) {
                throw new BadRequestException('Conditions require field and operator');
            }
        }
    }

    private async resolvePreviewRoleIds(
        input: EvaluationAutomationPreviewInput,
    ): Promise<number[]> {
        const roleIds = input.roleIds || [];
        if (input.roleCodes?.length) {
            const roles = await this.roleRepository.find({
                where: { code: In(input.roleCodes) },
            });
            roleIds.push(...roles.map(role => role.id));
        }
        return [...new Set(roleIds.map(id => Number(id)).filter(id => Number.isFinite(id)))];
    }

    private previewDepartmentMatches(
        automation: EvaluationAutomation,
        departmentIds: number[],
    ): boolean {
        const automationDepartmentIds = (automation.departments || []).map(
            department => department.id,
        );
        return (
            !automationDepartmentIds.length ||
            automationDepartmentIds.some(id => departmentIds.includes(id))
        );
    }

    private async mapPreviewAutomation(
        automation: EvaluationAutomation,
    ): Promise<EvaluationAutomationPreviewResultDto> {
        const scheduledAt = this.calculatePreviewScheduledAt(automation);

        return {
            automationId: automation.id,
            title: automation.title,
            triggerPoint: automation.triggerPoint,
            automationType: automation.automationType,
            resourceType:
                automation.automationType === EvaluationAutomationType.FIXED_SCHEME
                    ? EvaluationAutomationResourceType.EVALUATION_SCHEME_ASSIGNMENT
                    : EvaluationAutomationResourceType.ASSESSMENT,
            resourceName: await this.previewResourceName(automation),
            scheduledAt,
            delayLabel: `${automation.delayAmount || 0} ${this.delayUnitLabel(automation.delayUnit)}`,
        };
    }

    private calculatePreviewScheduledAt(automation: EvaluationAutomation): Date {
        const scheduledAt = new Date();
        switch (automation.delayUnit) {
            case EvaluationAutomationDelayUnit.MINUTES:
                scheduledAt.setMinutes(scheduledAt.getMinutes() + automation.delayAmount);
                break;
            case EvaluationAutomationDelayUnit.HOURS:
                scheduledAt.setHours(scheduledAt.getHours() + automation.delayAmount);
                break;
            case EvaluationAutomationDelayUnit.DAYS:
                scheduledAt.setDate(scheduledAt.getDate() + automation.delayAmount);
                break;
            case EvaluationAutomationDelayUnit.WEEKS:
                scheduledAt.setDate(scheduledAt.getDate() + automation.delayAmount * 7);
                break;
            case EvaluationAutomationDelayUnit.MONTHS:
                scheduledAt.setMonth(scheduledAt.getMonth() + automation.delayAmount);
                break;
            case EvaluationAutomationDelayUnit.YEARS:
                scheduledAt.setFullYear(scheduledAt.getFullYear() + automation.delayAmount);
                break;
        }
        return scheduledAt;
    }

    private delayUnitLabel(unit: EvaluationAutomationDelayUnit): string {
        switch (unit) {
            case EvaluationAutomationDelayUnit.MINUTES:
                return 'minuto(s)';
            case EvaluationAutomationDelayUnit.HOURS:
                return 'hora(s)';
            case EvaluationAutomationDelayUnit.DAYS:
                return 'día(s)';
            case EvaluationAutomationDelayUnit.WEEKS:
                return 'semana(s)';
            case EvaluationAutomationDelayUnit.MONTHS:
                return 'mes(es)';
            case EvaluationAutomationDelayUnit.YEARS:
                return 'año(s)';
            default:
                return unit;
        }
    }

    private async previewResourceName(automation: EvaluationAutomation): Promise<string> {
        if (automation.automationType === EvaluationAutomationType.FIXED_SCHEME) {
            return automation.scheme?.name || `Esquema #${automation.schemeId}`;
        }

        if (automation.questionnaireIds?.length) {
            const questionnaire = await this.questionnaireModel
                .findById(automation.questionnaireIds[0])
                .select('name');
            return questionnaire?.name || `Cuestionario #${automation.questionnaireIds[0]}`;
        }

        if (automation.questionnaireBundleIds?.length) {
            const bundle = await this.questionnaireBundleModel
                .findById(automation.questionnaireBundleIds[0])
                .select('name');
            return bundle?.name || `Paquete #${automation.questionnaireBundleIds[0]}`;
        }

        if (automation.randomizationRuleIds?.length) {
            const randomization = await this.randomizationRuleRepository.findOne(
                automation.randomizationRuleIds[0],
            );
            return randomization?.name || `Randomización #${automation.randomizationRuleIds[0]}`;
        }

        return (
            automation.evaluationName ||
            automation.assessmentType?.name ||
            'Evaluación individual'
        );
    }

    private async setDepartments(
        automationId: number,
        departmentIds: number[],
        departmentRepository: Repository<Department>,
        automationRepository: Repository<EvaluationAutomation>,
    ): Promise<void> {
        const departments = await departmentRepository.find({
            where: { id: In(departmentIds) },
        });
        const current = await automationRepository.findOne(automationId, {
            relations: ['departments'],
        });
        const currentIds = current?.departments?.map(department => department.id) || [];
        const nextIds = departments.map(department => department.id);
        const idsToAdd = nextIds.filter(id => !currentIds.includes(id));
        const idsToRemove = currentIds.filter(id => !nextIds.includes(id));

        await automationRepository
            .createQueryBuilder()
            .relation(EvaluationAutomation, 'departments')
            .of(automationId)
            .addAndRemove(idsToAdd, idsToRemove);
    }
}
