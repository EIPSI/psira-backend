import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRepository } from '@nestjs/typeorm';
import { Model, Types } from 'mongoose';
import { In, Repository } from 'typeorm';
import { applyQuery } from '@nestjs-query/core';
import { Department } from 'src/modules/department/models/department.model';
import {
    AddSchemeResourceTemplateInput,
    CreateEvaluationSchemeInput,
    defaultSchemeInformantType,
    IndependentEvaluationTemplateInput,
    SchemeResourceTemplateInput,
    SchemeSessionTemplateInput,
    UpdateEvaluationSchemeInput,
    UpdateIndependentEvaluationTemplateInput,
    UpdateSchemeResourceTemplateInput,
} from '../dtos/evaluation-scheme-management.input';
import { EvaluationSchemeType } from '../enums/evaluation-scheme-type.enum';
import { IndependentEvaluationTemplate } from '../models/independent-evaluation-template.model';
import { EvaluationScheme } from '../models/evaluation-scheme.model';
import { SchemeResourceTemplate } from '../models/scheme-resource-template.model';
import { SchemeSessionTemplate } from '../models/scheme-session-template.model';
import { Questionnaire } from 'src/modules/questionnaire/models/questionnaire.schema';
import { QuestionnaireBundle } from 'src/modules/questionnaire/models/questionnaire-bundle.schema';
import { RandomizationRule } from 'src/modules/randomization/models/randomization-rule.model';
import { User } from 'src/modules/user/models/user.model';
import {
    DepartmentAccessScope,
    UserDepartmentAccessService,
} from 'src/modules/user/services/user-department-access.service';
import {
    areDepartmentsCompatible,
    coversAllSelectedDepartments,
    uniqueDepartmentIds,
} from 'src/shared/department-compatibility';

@Injectable()
export class EvaluationSchemeManagementService {
    constructor(
        @InjectRepository(EvaluationScheme)
        private readonly schemeRepository: Repository<EvaluationScheme>,
        @InjectRepository(SchemeSessionTemplate)
        private readonly sessionTemplateRepository: Repository<SchemeSessionTemplate>,
        @InjectRepository(SchemeResourceTemplate)
        private readonly resourceTemplateRepository: Repository<SchemeResourceTemplate>,
        @InjectRepository(IndependentEvaluationTemplate)
        private readonly independentTemplateRepository: Repository<IndependentEvaluationTemplate>,
        @InjectRepository(RandomizationRule)
        private readonly randomizationRuleRepository: Repository<RandomizationRule>,
        @InjectModel(Questionnaire.name)
        private readonly questionnaireModel: Model<Questionnaire>,
        @InjectModel(QuestionnaireBundle.name)
        private readonly questionnaireBundleModel: Model<QuestionnaireBundle>,
        private readonly userDepartmentAccessService: UserDepartmentAccessService,
    ) {}

    async listSchemes(query: any, departmentIds: number[] = [], currentUser: User): Promise<EvaluationScheme[]> {
        const access = await this.userDepartmentAccessService.getUserDepartmentAccess(currentUser.id);
        const explicitDepartmentIds = uniqueDepartmentIds(departmentIds);
        const accessDepartmentIds = uniqueDepartmentIds(access.departmentIds);

        const schemes = await this.schemeRepository.find({
            relations: [
                'departments',
                'sessionTemplates',
                'sessionTemplates.resourceTemplates',
                'independentEvaluationTemplates',
            ],
        });

        const filteredSchemes = schemes.filter(scheme => {
            const schemeDepartmentIds = scheme.departments?.map(department => department.id) || [];
            const matchesUserScope = access.scope === DepartmentAccessScope.ALL ||
                !schemeDepartmentIds.length ||
                schemeDepartmentIds.some(id => accessDepartmentIds.includes(id));
            const matchesExplicitFilter = !explicitDepartmentIds.length ||
                areDepartmentsCompatible(explicitDepartmentIds, schemeDepartmentIds);

            return matchesUserScope && matchesExplicitFilter;
        });

        return applyQuery(filteredSchemes, query);
    }

    async createScheme(input: CreateEvaluationSchemeInput): Promise<EvaluationScheme> {
        this.validateSchemeTemplateShape(input);

        const scheme = await this.schemeRepository.save(
            this.schemeRepository.create({
                name: input.name,
                description: input.description,
                schemeType: input.schemeType,
                defaultRecurrenceRule: input.defaultRecurrenceRule,
                defaultDurationMinutes: input.defaultDurationMinutes || 60,
                durationDays: input.durationDays || 7,
                active: input.active === undefined ? true : input.active,
                emailNotificationsEnabled:
                    input.emailNotificationsEnabled === undefined
                        ? true
                        : input.emailNotificationsEnabled,
                mailTemplateId: input.mailTemplateId,
            }),
        );

        await this.setSchemeDepartments(scheme.id, input.departmentIds);

        for (const sessionTemplate of input.sessionTemplates || []) {
            await this.addSessionTemplate({
                ...sessionTemplate,
                schemeId: scheme.id,
            });
        }

        for (const independentTemplate of input.independentEvaluationTemplates || []) {
            await this.addIndependentEvaluationTemplate({
                ...independentTemplate,
                schemeId: scheme.id,
            });
        }

        return this.getSchemeOrFail(scheme.id);
    }

    async updateScheme(input: UpdateEvaluationSchemeInput): Promise<EvaluationScheme> {
        const scheme = await this.schemeRepository.findOne(input.id);
        if (!scheme) throw new NotFoundException('Evaluation scheme not found');

        if (input.name !== undefined) scheme.name = input.name;
        if (input.description !== undefined) scheme.description = input.description;
        if (input.defaultRecurrenceRule !== undefined) {
            scheme.defaultRecurrenceRule = input.defaultRecurrenceRule;
        }
        if (input.defaultDurationMinutes !== undefined) {
            scheme.defaultDurationMinutes = input.defaultDurationMinutes;
        }
        if (input.durationDays !== undefined) {
            scheme.durationDays = input.durationDays;
        }
        if (input.active !== undefined) scheme.active = input.active;
        if (input.emailNotificationsEnabled !== undefined) {
            scheme.emailNotificationsEnabled = input.emailNotificationsEnabled;
        }
        if (input.mailTemplateId !== undefined) {
            scheme.mailTemplateId = input.mailTemplateId;
        }

        await this.schemeRepository.save(scheme);
        if (input.departmentIds !== undefined) {
            await this.validateExistingSchemeContent(input.id, input.departmentIds);
            await this.setSchemeDepartments(scheme.id, input.departmentIds);
        }
        return this.getSchemeOrFail(scheme.id);
    }

    async deleteScheme(id: number): Promise<boolean> {
        const scheme = await this.schemeRepository.findOne(id);
        if (!scheme) return true;

        await this.schemeRepository.manager.transaction(async manager => {
            await manager.query(
                'UPDATE assessment SET "schemeResourceTemplateId" = NULL WHERE "schemeResourceTemplateId" IN (SELECT srt.id FROM scheme_resource_template srt INNER JOIN scheme_session_template sst ON sst.id = srt."sessionTemplateId" WHERE sst."schemeId" = $1)',
                [id],
            );
            await manager.query(
                'UPDATE clinical_session_resource SET "resourceTemplateId" = NULL WHERE "resourceTemplateId" IN (SELECT srt.id FROM scheme_resource_template srt INNER JOIN scheme_session_template sst ON sst.id = srt."sessionTemplateId" WHERE sst."schemeId" = $1)',
                [id],
            );
            await manager.query(
                'UPDATE clinical_session SET "sessionTemplateId" = NULL WHERE "sessionTemplateId" IN (SELECT id FROM scheme_session_template WHERE "schemeId" = $1)',
                [id],
            );
            await manager.query(
                'UPDATE assessment SET "schemeId" = NULL, "schemeAssignmentId" = NULL WHERE "schemeId" = $1 OR "schemeAssignmentId" IN (SELECT id FROM evaluation_scheme_assignment WHERE "schemeId" = $1)',
                [id],
            );
            await manager.query(
                'UPDATE calendar_occurrence SET "schemeId" = NULL, "schemeAssignmentId" = NULL, "isDetachedFromTemplate" = true WHERE "schemeId" = $1 OR "schemeAssignmentId" IN (SELECT id FROM evaluation_scheme_assignment WHERE "schemeId" = $1)',
                [id],
            );
            await manager.query(
                'DELETE FROM scheme_resource_template WHERE "sessionTemplateId" IN (SELECT id FROM scheme_session_template WHERE "schemeId" = $1)',
                [id],
            );
            await manager.delete(SchemeSessionTemplate, { schemeId: id });
            await manager.delete(IndependentEvaluationTemplate, { schemeId: id });
            await manager.query(
                'DELETE FROM evaluation_scheme_department WHERE "evaluationSchemeId" = $1',
                [id],
            );
            await manager.query(
                'DELETE FROM evaluation_scheme_assignment WHERE "schemeId" = $1',
                [id],
            );
            await manager.delete(EvaluationScheme, id);
        });

        return true;
    }

    async addSessionTemplate(
        input: SchemeSessionTemplateInput,
    ): Promise<SchemeSessionTemplate> {
        if (!input.schemeId) throw new BadRequestException('schemeId is required');
        await this.ensureScheme(input.schemeId, EvaluationSchemeType.SESSION_BASED);

        const sessionTemplate = await this.sessionTemplateRepository.save(
            this.sessionTemplateRepository.create({
                schemeId: input.schemeId,
                sessionKind: input.sessionKind,
                sessionIndex: input.sessionIndex,
                title: input.title,
                relativeOffsetDays: input.relativeOffsetDays || 0,
                durationMinutes: input.durationMinutes || 60,
            }),
        );

        for (const resourceTemplate of input.resourceTemplates || []) {
            await this.addResourceTemplate({
                ...resourceTemplate,
                sessionTemplateId: sessionTemplate.id,
            });
        }

        return this.sessionTemplateRepository.findOneOrFail(sessionTemplate.id, {
            relations: ['resourceTemplates'],
        });
    }

    async addResourceTemplate(
        input: AddSchemeResourceTemplateInput,
    ): Promise<SchemeResourceTemplate> {
        const sessionTemplate = await this.sessionTemplateRepository.findOne(
            input.sessionTemplateId,
        );
        if (!sessionTemplate) {
            throw new NotFoundException('Session template not found');
        }
        const schemeDepartmentIds = await this.getSchemeDepartmentIds(sessionTemplate.schemeId);
        await this.validateResourceTemplateInput(input, schemeDepartmentIds);

        return this.resourceTemplateRepository.save(
            this.resourceTemplateRepository.create({
                sessionTemplateId: input.sessionTemplateId,
                ...this.mapResourceTemplateInput(input),
            }),
        );
    }

    async updateResourceTemplate(
        input: UpdateSchemeResourceTemplateInput,
    ): Promise<SchemeResourceTemplate> {
        const resourceTemplate = await this.resourceTemplateRepository.findOne(input.id);
        if (!resourceTemplate) {
            throw new NotFoundException('Resource template not found');
        }
        const existingSessionTemplate = await this.sessionTemplateRepository.findOne(resourceTemplate.sessionTemplateId);
        const schemeDepartmentIds = await this.getSchemeDepartmentIds(existingSessionTemplate?.schemeId);
        await this.validateResourceTemplateInput(input, schemeDepartmentIds);

        Object.assign(resourceTemplate, this.mapResourceTemplateInput(input));
        await this.resourceTemplateRepository.save(resourceTemplate);
        return this.resourceTemplateRepository.findOneOrFail(resourceTemplate.id);
    }

    async deleteResourceTemplate(id: number): Promise<boolean> {
        const resourceTemplate = await this.resourceTemplateRepository.findOne(id);
        if (!resourceTemplate) return true;
        await this.resourceTemplateRepository.query(
            'UPDATE assessment SET "schemeResourceTemplateId" = NULL WHERE "schemeResourceTemplateId" = $1',
            [id],
        );
        await this.resourceTemplateRepository.query(
            'UPDATE clinical_session_resource SET "resourceTemplateId" = NULL WHERE "resourceTemplateId" = $1',
            [id],
        );
        await this.resourceTemplateRepository.delete(id);
        return true;
    }

    async addIndependentEvaluationTemplate(
        input: IndependentEvaluationTemplateInput,
    ): Promise<IndependentEvaluationTemplate> {
        if (!input.schemeId) throw new BadRequestException('schemeId is required');
        await this.ensureScheme(
            input.schemeId,
            EvaluationSchemeType.INDEPENDENT_EVALUATION,
        );
        const schemeDepartmentIds = await this.getSchemeDepartmentIds(input.schemeId);
        await this.validateIndependentTemplateInput(input, schemeDepartmentIds);

        return this.independentTemplateRepository.save(
            this.independentTemplateRepository.create({
                schemeId: input.schemeId,
                ...this.mapIndependentTemplateInput(input),
            }),
        );
    }

    async updateIndependentEvaluationTemplate(
        input: UpdateIndependentEvaluationTemplateInput,
    ): Promise<IndependentEvaluationTemplate> {
        const template = await this.independentTemplateRepository.findOne(input.id);
        if (!template) {
            throw new NotFoundException('Independent evaluation template not found');
        }
        const schemeDepartmentIds = await this.getSchemeDepartmentIds(template.schemeId);
        await this.validateIndependentTemplateInput(input, schemeDepartmentIds);

        Object.assign(template, this.mapIndependentTemplateInput(input));
        await this.independentTemplateRepository.save(template);
        return this.independentTemplateRepository.findOneOrFail(template.id);
    }

    async deleteIndependentEvaluationTemplate(id: number): Promise<boolean> {
        const template = await this.independentTemplateRepository.findOne(id);
        if (!template) return true;
        await this.independentTemplateRepository.delete(id);
        return true;
    }

    async clearIndependentEvaluationTemplates(schemeId: number): Promise<boolean> {
        await this.ensureScheme(
            schemeId,
            EvaluationSchemeType.INDEPENDENT_EVALUATION,
        );
        await this.independentTemplateRepository.delete({ schemeId });
        return true;
    }

    private async getSchemeOrFail(id: number): Promise<EvaluationScheme> {
        return this.schemeRepository.findOneOrFail(id, {
            relations: [
                'sessionTemplates',
                'sessionTemplates.resourceTemplates',
                'independentEvaluationTemplates',
                'departments',
            ],
        });
    }

    private async ensureScheme(
        schemeId: number,
        expectedType: EvaluationSchemeType,
    ): Promise<EvaluationScheme> {
        const scheme = await this.schemeRepository.findOne(schemeId);
        if (!scheme) throw new NotFoundException('Evaluation scheme not found');
        if (scheme.schemeType !== expectedType) {
            throw new BadRequestException(
                `Scheme must be ${expectedType} to add this template`,
            );
        }
        return scheme;
    }

    private validateSchemeTemplateShape(input: CreateEvaluationSchemeInput): void {
        if (
            input.schemeType === EvaluationSchemeType.SESSION_BASED &&
            input.independentEvaluationTemplates?.length
        ) {
            throw new BadRequestException(
                'Session-based schemes cannot include independent evaluation templates',
            );
        }

        if (
            input.schemeType === EvaluationSchemeType.INDEPENDENT_EVALUATION &&
            input.sessionTemplates?.length
        ) {
            throw new BadRequestException(
                'Independent evaluation schemes cannot include session templates',
            );
        }
    }

    private mapResourceTemplateInput(input: SchemeResourceTemplateInput) {
        return {
            resourceKind: input.resourceKind,
            assessmentTypeId: input.assessmentTypeId,
            name: input.name?.trim() || null,
            questionnaireIds: input.questionnaireIds || [],
            questionnaireBundleIds: input.questionnaireBundleIds || [],
            randomizationRuleIds: input.randomizationRuleIds || [],
            sessionSelector: input.sessionSelector,
            everyNSessions: input.everyNSessions,
            startSessionNumber: input.startSessionNumber,
            endSessionNumber: input.endSessionNumber,
            informantType: input.informantType || defaultSchemeInformantType,
            defaultResponderRole: input.defaultResponderRole,
            activationAnchor: input.activationAnchor,
            activationOffsetMinutes: input.activationOffsetMinutes,
            availabilityDurationMinutes: input.availabilityDurationMinutes,
            availabilityDurationUnit: input.availabilityDurationUnit || 'MINUTES',
            reminderMinutes: input.reminderMinutes || [],
            reminderUnit: input.reminderUnit || 'MINUTES',
        };
    }

    private mapIndependentTemplateInput(input: IndependentEvaluationTemplateInput) {
        const startMinute =
            input.startMinuteOfDay === undefined || input.startMinuteOfDay === null
                ? input.relativeMinuteOfDay || 0
                : input.startMinuteOfDay;
        const duration = input.durationMinutes || 60;
        const endMinute = input.endMinuteOfDay === undefined
            ? startMinute + duration
            : input.endMinuteOfDay;

        return {
            assessmentTypeId: input.assessmentTypeId,
            name: input.name?.trim() || null,
            questionnaireIds: input.questionnaireIds || [],
            questionnaireBundleIds: input.questionnaireBundleIds || [],
            randomizationRuleIds: input.randomizationRuleIds || [],
            relativeDay: input.relativeDay || 0,
            relativeMinuteOfDay: startMinute,
            startMinuteOfDay: startMinute,
            durationMinutes: duration,
            endMinuteOfDay: endMinute,
            triggerMode: input.triggerMode || 'BLOCK_START',
            availabilityDurationMinutes: input.availabilityDurationMinutes || duration,
            availabilityDurationUnit: input.availabilityDurationUnit || 'MINUTES',
            reminderMinutes: input.reminderMinutes || [],
            reminderUnit: input.reminderUnit || 'MINUTES',
            required: input.required === undefined ? false : input.required,
            singleResponse: input.singleResponse === undefined ? true : input.singleResponse,
            seedOrder: input.seedOrder || 0,
            informantType: input.informantType || defaultSchemeInformantType,
            defaultResponderRole: input.defaultResponderRole,
        };
    }

    private async setSchemeDepartments(
        schemeId: number,
        departmentIds?: number[],
    ): Promise<void> {
        if (departmentIds === undefined) return;

        const departments = departmentIds.length
            ? await Department.find({ where: { id: In(departmentIds) } })
            : [];

        if (departments.length !== departmentIds.length) {
            throw new NotFoundException('One of the departments does not exist');
        }

        const existing = await this.schemeRepository.findOne(schemeId, {
            relations: ['departments'],
        });
        const currentIds = existing?.departments?.map(department => department.id) || [];
        const idsToAdd = departmentIds.filter(id => !currentIds.includes(id));
        const idsToRemove = currentIds.filter(id => !departmentIds.includes(id));

        await this.schemeRepository
            .createQueryBuilder()
            .relation(EvaluationScheme, 'departments')
            .of(schemeId)
            .addAndRemove(idsToAdd, idsToRemove);
    }

    private async validateResourceTemplateInput(
        input: SchemeResourceTemplateInput,
        schemeDepartmentIds: number[] = [],
    ): Promise<void> {
        const questionnaireCount = input.questionnaireIds?.length || 0;
        const bundleCount = input.questionnaireBundleIds?.length || 0;
        const randomizationCount = input.randomizationRuleIds?.length || 0;
        const totalSelectionCount = questionnaireCount + bundleCount + randomizationCount;

        if (totalSelectionCount > 1) {
            throw new BadRequestException(
                'Choose either one questionnaire, one questionnaire bundle, or one randomization',
            );
        }

        if (!totalSelectionCount) {
            throw new BadRequestException(
                'A questionnaire, questionnaire bundle, or randomization is required',
            );
        }

        await this.validateContentDepartments(input, schemeDepartmentIds);
    }

    private async validateIndependentTemplateInput(
        input: IndependentEvaluationTemplateInput,
        schemeDepartmentIds: number[] = [],
    ): Promise<void> {
        const questionnaireCount = input.questionnaireIds?.length || 0;
        const bundleCount = input.questionnaireBundleIds?.length || 0;
        const randomizationCount = input.randomizationRuleIds?.length || 0;
        const totalSelectionCount = questionnaireCount + bundleCount + randomizationCount;

        if (totalSelectionCount > 1) {
            throw new BadRequestException(
                'Choose either one questionnaire, one questionnaire bundle, or one randomization',
            );
        }

        if (!totalSelectionCount) {
            throw new BadRequestException(
                'A questionnaire, questionnaire bundle, or randomization is required',
            );
        }

        await this.validateContentDepartments(input, schemeDepartmentIds);
    }

    private async getSchemeDepartmentIds(schemeId?: number): Promise<number[]> {
        if (!schemeId) return [];
        const scheme = await this.schemeRepository.findOne(schemeId, {
            relations: ['departments'],
        });
        return scheme?.departments?.map(department => department.id) || [];
    }

    private async validateContentDepartments(
        input: Pick<SchemeResourceTemplateInput, 'questionnaireIds' | 'questionnaireBundleIds' | 'randomizationRuleIds'>,
        schemeDepartmentIds: number[],
    ): Promise<void> {
        if (input.questionnaireIds?.length) {
            const questionnaires = await this.questionnaireModel.find({
                _id: { $in: input.questionnaireIds.map(id => Types.ObjectId(id)) },
                zombie: { $ne: true },
            }).select('_id name departmentIds');
            if (questionnaires.length !== input.questionnaireIds.length) {
                throw new NotFoundException('One of the questionnaires does not exist');
            }
            const incompatibleQuestionnaire = questionnaires.find(questionnaire =>
                !coversAllSelectedDepartments(schemeDepartmentIds, questionnaire.departmentIds),
            );
            if (incompatibleQuestionnaire) {
                throw new BadRequestException(
                    `Questionnaire "${incompatibleQuestionnaire.name}" is not compatible with the selected scheme departments`,
                );
            }
        }

        if (input.questionnaireBundleIds?.length) {
            const bundles = await this.questionnaireBundleModel.find({
                _id: { $in: input.questionnaireBundleIds.map(id => Types.ObjectId(id)) },
                deleted: { $ne: true },
            }).select('_id name departmentIds');
            if (bundles.length !== input.questionnaireBundleIds.length) {
                throw new NotFoundException('One of the questionnaire bundles does not exist');
            }
            const incompatibleBundle = bundles.find(bundle =>
                !coversAllSelectedDepartments(schemeDepartmentIds, bundle.departmentIds),
            );
            if (incompatibleBundle) {
                throw new BadRequestException(
                    `Questionnaire bundle "${incompatibleBundle.name}" is not compatible with the selected scheme departments`,
                );
            }
        }

        if (input.randomizationRuleIds?.length) {
            const randomizations = await this.randomizationRuleRepository.find({
                where: { id: In(input.randomizationRuleIds) },
                relations: ['departments'],
            });
            if (randomizations.length !== input.randomizationRuleIds.length) {
                throw new NotFoundException('One of the randomizations does not exist');
            }
            const incompatibleRandomization = randomizations.find(randomization =>
                !coversAllSelectedDepartments(
                    schemeDepartmentIds,
                    randomization.departments?.map(department => department.id) || [],
                ),
            );
            if (incompatibleRandomization) {
                throw new BadRequestException(
                    `Randomization "${incompatibleRandomization.name}" is not compatible with the selected scheme departments`,
                );
            }
        }
    }

    private async validateExistingSchemeContent(
        schemeId: number,
        schemeDepartmentIds: number[],
    ): Promise<void> {
        const scheme = await this.schemeRepository.findOne(schemeId, {
            relations: [
                'sessionTemplates',
                'sessionTemplates.resourceTemplates',
                'independentEvaluationTemplates',
            ],
        });
        if (!scheme) throw new NotFoundException('Evaluation scheme not found');

        for (const sessionTemplate of scheme.sessionTemplates || []) {
            for (const resourceTemplate of sessionTemplate.resourceTemplates || []) {
                await this.validateContentDepartments(resourceTemplate, schemeDepartmentIds);
            }
        }

        for (const independentTemplate of scheme.independentEvaluationTemplates || []) {
            await this.validateContentDepartments(independentTemplate, schemeDepartmentIds);
        }
    }
}
