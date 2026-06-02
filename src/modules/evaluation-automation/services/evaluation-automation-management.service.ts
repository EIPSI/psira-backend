import { applyQuery } from '@nestjs-query/core';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRepository } from '@nestjs/typeorm';
import { Model, Types } from 'mongoose';
import { AssessmentType } from 'src/modules/assessment/models/assessment-type.model';
import { Department } from 'src/modules/department/models/department.model';
import { EvaluationSchemeType } from 'src/modules/evaluation-scheme/enums/evaluation-scheme-type.enum';
import { EvaluationScheme } from 'src/modules/evaluation-scheme/models/evaluation-scheme.model';
import { MailTemplate } from 'src/modules/mail/models/mail-template.model';
import { Role } from 'src/modules/permission/models/role.model';
import { QuestionnaireBundle } from 'src/modules/questionnaire/models/questionnaire-bundle.schema';
import { Questionnaire } from 'src/modules/questionnaire/models/questionnaire.schema';
import { RandomizationRule } from 'src/modules/randomization/models/randomization-rule.model';
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
        @InjectModel(Questionnaire.name)
        private readonly questionnaireModel: Model<Questionnaire>,
        @InjectModel(QuestionnaireBundle.name)
        private readonly questionnaireBundleModel: Model<QuestionnaireBundle>,
        private readonly engineService: EvaluationAutomationEngineService,
    ) {}

    async listAutomations(query: any): Promise<EvaluationAutomation[]> {
        const automations = await this.automationRepository.find({
            relations: this.automationRelations,
        });
        return applyQuery(automations, query);
    }

    async getAutomationOrFail(id: number): Promise<EvaluationAutomation> {
        const automation = await this.automationRepository.findOne(id, {
            relations: this.automationRelations,
        });
        if (!automation) throw new NotFoundException('Automation not found');
        return automation;
    }

    async listRuns(query: any, automationId?: number): Promise<EvaluationAutomationRun[]> {
        const runs = await this.runRepository.find({
            where: automationId ? { automationId } : {},
            relations: ['automation', 'user'],
        });
        return applyQuery(runs, query);
    }

    async previewAutomations(
        input: EvaluationAutomationPreviewInput,
    ): Promise<EvaluationAutomationPreviewResultDto[]> {
        const roleIds = await this.resolvePreviewRoleIds(input);
        const departmentIds = input.departmentIds || [];
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
    ): Promise<EvaluationAutomation> {
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

        return this.getAutomationOrFail(automation.id);
    }

    async updateAutomation(
        input: UpdateEvaluationAutomationInput,
    ): Promise<EvaluationAutomation> {
        const current = await this.getAutomationOrFail(input.id);
        const nextDepartmentIds = input.departmentIds === undefined
            ? current.departments?.map(department => department.id) || []
            : input.departmentIds;
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

        return this.getAutomationOrFail(input.id);
    }

    async duplicateAutomation(id: number): Promise<EvaluationAutomation> {
        const automation = await this.getAutomationOrFail(id);
        return this.createAutomation({
            title: `${automation.title} copy`,
            description: automation.description,
            active: automation.active,
            departmentIds: automation.departments?.map(department => department.id) || [],
            roleId: automation.roleId,
            conditions: automation.conditions || [],
            triggerPoint: automation.triggerPoint,
            automationType: automation.automationType,
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
        });
    }

    async setActive(id: number, active: boolean): Promise<EvaluationAutomation> {
        const automation = await this.automationRepository.findOne(id);
        if (!automation) throw new NotFoundException('Automation not found');
        automation.active = active;
        await this.automationRepository.save(automation);
        return this.getAutomationOrFail(id);
    }

    async deleteAutomation(id: number): Promise<boolean> {
        const automation = await this.automationRepository.findOne(id);
        if (!automation) return true;
        await this.automationRepository.delete(id);
        return true;
    }

    async testAutomation(
        input: TestEvaluationAutomationInput,
    ): Promise<EvaluationAutomationTestResultDto> {
        const result = await this.engineService.simulateAutomation(
            input.automationId,
            {
                triggerPoint: input.triggerPoint,
                userId: input.userId,
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
        if (input.delayAmount === undefined || input.delayAmount === null || input.delayAmount < 0) {
            throw new BadRequestException('Delay must be greater than or equal to zero');
        }
        if (!input.delayUnit) throw new BadRequestException('Delay unit is required');
        if (input.priority !== undefined && input.priority < 1) {
            throw new BadRequestException('Priority must be a positive integer');
        }

        const departmentIds = uniqueDepartmentIds(input.departmentIds);
        await this.validateDepartments(departmentIds);
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
        if (input.delayUnit !== EvaluationAutomationDelayUnit.DAYS) {
            throw new BadRequestException('Fixed scheme delay must be expressed in days');
        }
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
        if (input.delayUnit !== EvaluationAutomationDelayUnit.MINUTES) {
            throw new BadRequestException('Individual evaluation delay must be expressed in minutes');
        }
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
        const scheduledAt = new Date();
        if (automation.delayUnit === EvaluationAutomationDelayUnit.DAYS) {
            scheduledAt.setDate(scheduledAt.getDate() + automation.delayAmount);
        } else {
            scheduledAt.setMinutes(scheduledAt.getMinutes() + automation.delayAmount);
        }

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
            delayLabel: `${automation.delayAmount || 0} ${
                automation.delayUnit === EvaluationAutomationDelayUnit.DAYS
                    ? 'día(s)'
                    : 'minuto(s)'
            }`,
        };
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
