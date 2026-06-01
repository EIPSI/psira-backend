import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRepository } from '@nestjs/typeorm';
import { Model, Types } from 'mongoose';
import { Department } from 'src/modules/department/models/department.model';
import { EvaluationSchemeType } from 'src/modules/evaluation-scheme/enums/evaluation-scheme-type.enum';
import { EvaluationScheme } from 'src/modules/evaluation-scheme/models/evaluation-scheme.model';
import { QuestionnaireBundle } from 'src/modules/questionnaire/models/questionnaire-bundle.schema';
import { Questionnaire } from 'src/modules/questionnaire/models/questionnaire.schema';
import { In, Repository } from 'typeorm';
import { applyQuery } from '@nestjs-query/core';
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
import {
    CreateRandomizationRuleInput,
    RandomizationRuleItemInput,
    UpdateRandomizationRuleInput,
} from '../dtos/randomization-rule.input';
import { RandomizationRuleItemType } from '../enums/randomization-rule-item-type.enum';
import { RandomizationRuleType } from '../enums/randomization-rule-type.enum';
import { RandomizationRuleItem } from '../models/randomization-rule-item.model';
import { RandomizationRule } from '../models/randomization-rule.model';

@Injectable()
export class RandomizationRuleService {
    constructor(
        @InjectRepository(RandomizationRule)
        private readonly ruleRepository: Repository<RandomizationRule>,
        @InjectRepository(RandomizationRuleItem)
        private readonly itemRepository: Repository<RandomizationRuleItem>,
        @InjectRepository(Department)
        private readonly departmentRepository: Repository<Department>,
        @InjectRepository(EvaluationScheme)
        private readonly schemeRepository: Repository<EvaluationScheme>,
        @InjectModel(Questionnaire.name)
        private readonly questionnaireModel: Model<Questionnaire>,
        @InjectModel(QuestionnaireBundle.name)
        private readonly bundleModel: Model<QuestionnaireBundle>,
        private readonly userDepartmentAccessService: UserDepartmentAccessService,
    ) {}

    async list(query: any, departmentIds: number[] = [], currentUser: User): Promise<RandomizationRule[]> {
        const access = await this.userDepartmentAccessService.getUserDepartmentAccess(currentUser.id);
        const explicitDepartmentIds = uniqueDepartmentIds(departmentIds);

        const rules = await this.ruleRepository.find({
            relations: ['departments', 'items'],
        });

        const filteredRules = rules.filter(rule => {
            const ruleDepartmentIds = rule.departments?.map(department => department.id) || [];
            const accessDepartmentIds = uniqueDepartmentIds(access.departmentIds);
            const matchesUserScope = access.scope === DepartmentAccessScope.ALL ||
                !ruleDepartmentIds.length ||
                ruleDepartmentIds.some(id => accessDepartmentIds.includes(id));
            const matchesExplicitFilter = !explicitDepartmentIds.length ||
                areDepartmentsCompatible(explicitDepartmentIds, ruleDepartmentIds);

            return matchesUserScope && matchesExplicitFilter;
        });

        filteredRules.forEach(rule => {
            rule.items = (rule.items || []).sort((a, b) => a.position - b.position);
        });

        return applyQuery(filteredRules, query);
    }

    async createRule(
        input: CreateRandomizationRuleInput,
        currentUser?: User,
    ): Promise<RandomizationRule> {
        this.validateName(input.name);
        await this.validateRuleInput(input.type, input.items, input.departmentIds);
        if (currentUser) {
            await this.validateDepartmentAccess(currentUser, input.departmentIds || []);
        }

        const rule = await this.ruleRepository.manager.transaction(
            async manager => {
                const createdRule = await manager.save(
                    RandomizationRule,
                    manager.create(RandomizationRule, {
                        name: input.name.trim(),
                        type: input.type,
                        active: input.active === undefined ? true : input.active,
                    }),
                );

                await this.setDepartments(
                    createdRule.id,
                    input.departmentIds,
                    manager.getRepository(Department),
                    manager.getRepository(RandomizationRule),
                );
                await this.replaceItems(
                    createdRule.id,
                    input.items,
                    manager.getRepository(RandomizationRuleItem),
                );

                return createdRule;
            },
        );

        return this.getRuleOrFail(rule.id);
    }

    async updateRule(
        input: UpdateRandomizationRuleInput,
        currentUser?: User,
    ): Promise<RandomizationRule> {
        const currentRule = await this.ruleRepository.findOne(input.id, {
            relations: ['departments', 'items'],
        });
        if (!currentRule) throw new NotFoundException('Randomization rule not found');

        if (input.name !== undefined) this.validateName(input.name);
        const nextType = input.type || currentRule.type;
        const nextItems = input.items || currentRule.items;
        const nextDepartmentIds = input.departmentIds === undefined
            ? currentRule.departments?.map(department => department.id) || []
            : input.departmentIds;
        await this.validateRuleInput(nextType, nextItems, nextDepartmentIds);
        if (currentUser) {
            await this.validateDepartmentAccess(currentUser, nextDepartmentIds);
        }

        await this.ruleRepository.manager.transaction(async manager => {
            const rule = await manager.findOne(RandomizationRule, input.id);
            if (!rule) throw new NotFoundException('Randomization rule not found');

            if (input.name !== undefined) rule.name = input.name.trim();
            if (input.type !== undefined) rule.type = input.type;
            if (input.active !== undefined) rule.active = input.active;
            await manager.save(RandomizationRule, rule);

            if (input.departmentIds !== undefined) {
                await this.setDepartments(
                    rule.id,
                    input.departmentIds,
                    manager.getRepository(Department),
                    manager.getRepository(RandomizationRule),
                );
            }

            if (input.items !== undefined) {
                await manager.delete(RandomizationRuleItem, {
                    randomizationRuleId: rule.id,
                });
                await this.replaceItems(
                    rule.id,
                    input.items,
                    manager.getRepository(RandomizationRuleItem),
                );
            }
        });

        return this.getRuleOrFail(input.id);
    }

    async duplicateRule(id: number, currentUser?: User): Promise<RandomizationRule> {
        const rule = await this.getRuleOrFail(id);
        return this.createRule({
            name: `${rule.name} copy`,
            type: rule.type,
            active: rule.active,
            departmentIds: rule.departments?.map(department => department.id) || [],
            items: rule.items.map(item => ({
                itemType: item.itemType,
                questionnaireId: item.questionnaireId,
                questionnaireBundleId: item.questionnaireBundleId,
                evaluationSchemeId: item.evaluationSchemeId,
                weight: item.weight,
                position: item.position,
            })),
        }, currentUser);
    }

    async setActive(id: number, active: boolean): Promise<RandomizationRule> {
        const rule = await this.ruleRepository.findOne(id);
        if (!rule) throw new NotFoundException('Randomization rule not found');
        rule.active = active;
        await this.ruleRepository.save(rule);
        return this.getRuleOrFail(rule.id);
    }

    async deleteRule(id: number): Promise<boolean> {
        const rule = await this.ruleRepository.findOne(id);
        if (!rule) return true;
        await this.ruleRepository.delete(id);
        return true;
    }

    async getRuleOrFail(id: number): Promise<RandomizationRule> {
        const rule = await this.ruleRepository.findOne(id, {
            relations: ['departments', 'items'],
        });
        if (!rule) throw new NotFoundException('Randomization rule not found');
        rule.items = (rule.items || []).sort((a, b) => a.position - b.position);
        return rule;
    }

    private async validateRuleInput(
        type: RandomizationRuleType,
        items: RandomizationRuleItemInput[],
        departmentIds?: number[],
    ): Promise<void> {
        if (!type) throw new BadRequestException('Randomization type is required');
        if (!items || items.length < 2) {
            throw new BadRequestException(
                'A randomization rule requires at least two items',
            );
        }

        if (departmentIds !== undefined) {
            await this.validateDepartments(departmentIds);
        }

        this.validateItemsForType(type, items);
        await this.validateReferencedItems(items);
        await this.validateItemDepartmentCompatibility(items, departmentIds || []);
    }

    private validateName(name: string): void {
        if (!name || !name.trim()) {
            throw new BadRequestException('Randomization rule name is required');
        }
    }

    private async validateDepartments(departmentIds: number[]): Promise<void> {
        const uniqueDepartmentIds = [...new Set(departmentIds || [])];
        if (!uniqueDepartmentIds.length) return;

        const count = await this.departmentRepository.count({
            where: { id: In(uniqueDepartmentIds) },
        });
        if (count !== uniqueDepartmentIds.length) {
            throw new NotFoundException('One of the departments does not exist');
        }
    }

    private async validateDepartmentAccess(
        currentUser: User,
        departmentIds: number[],
    ): Promise<void> {
        const canAccess = await this.userDepartmentAccessService.canAccessDepartments(
            currentUser.id,
            uniqueDepartmentIds(departmentIds),
        );
        if (!canAccess) {
            throw new ForbiddenException('Cannot assign randomization to these departments');
        }
    }

    private validateItemsForType(
        type: RandomizationRuleType,
        items: RandomizationRuleItemInput[],
    ): void {
        const seen = new Set<string>();

        items.forEach((item, index) => {
            if (!item.itemType) {
                throw new BadRequestException('Randomization item type is required');
            }

            const weight = Number(item.weight);
            if (!Number.isFinite(weight) || weight <= 0) {
                throw new BadRequestException(
                    'Randomization item weight must be greater than zero',
                );
            }

            const itemKey = this.itemKey(type, item, index);
            if (seen.has(itemKey)) {
                throw new BadRequestException(
                    'Randomization rules cannot include duplicated items',
                );
            }
            seen.add(itemKey);
        });
    }

    private itemKey(
        type: RandomizationRuleType,
        item: RandomizationRuleItemInput,
        index: number,
    ): string {
        if (type === RandomizationRuleType.LOW_LEVEL) {
            if (
                item.itemType !== RandomizationRuleItemType.QUESTIONNAIRE &&
                item.itemType !== RandomizationRuleItemType.QUESTIONNAIRE_BUNDLE
            ) {
                throw new BadRequestException(
                    'Low level randomization only supports questionnaires and questionnaire bundles',
                );
            }

            if (item.itemType === RandomizationRuleItemType.QUESTIONNAIRE) {
                if (item.questionnaireBundleId || item.evaluationSchemeId) {
                    throw new BadRequestException(
                        'Questionnaire items cannot include bundle or scheme references',
                    );
                }
                if (!item.questionnaireId) {
                    throw new BadRequestException('questionnaireId is required');
                }
                return `${item.itemType}:${item.questionnaireId}`;
            }

            if (item.questionnaireId || item.evaluationSchemeId) {
                throw new BadRequestException(
                    'Questionnaire bundle items cannot include questionnaire or scheme references',
                );
            }
            if (!item.questionnaireBundleId) {
                throw new BadRequestException('questionnaireBundleId is required');
            }
            return `${item.itemType}:${item.questionnaireBundleId}`;
        }

        if (item.itemType !== RandomizationRuleItemType.EVALUATION_SCHEME) {
            throw new BadRequestException(
                'High level randomization only supports fixed evaluation schemes',
            );
        }
        if (item.questionnaireId || item.questionnaireBundleId) {
            throw new BadRequestException(
                'Evaluation scheme items cannot include questionnaire or bundle references',
            );
        }
        if (!item.evaluationSchemeId) {
            throw new BadRequestException('evaluationSchemeId is required');
        }
        return `${item.itemType}:${item.evaluationSchemeId || index}`;
    }

    private async validateReferencedItems(
        items: RandomizationRuleItemInput[],
    ): Promise<void> {
        const questionnaireIds = this.uniqueObjectIds(
            items
                .filter(item => item.itemType === RandomizationRuleItemType.QUESTIONNAIRE)
                .map(item => item.questionnaireId),
            'questionnaireId',
        );
        const bundleIds = this.uniqueObjectIds(
            items
                .filter(
                    item =>
                        item.itemType ===
                        RandomizationRuleItemType.QUESTIONNAIRE_BUNDLE,
                )
                .map(item => item.questionnaireBundleId),
            'questionnaireBundleId',
        );
        const schemeIds = [
            ...new Set(
                items
                    .filter(
                        item =>
                            item.itemType ===
                            RandomizationRuleItemType.EVALUATION_SCHEME,
                    )
                    .map(item => item.evaluationSchemeId)
                    .filter(id => id !== undefined && id !== null),
            ),
        ] as number[];

        if (questionnaireIds.length) {
            const count = await this.questionnaireModel.countDocuments({
                _id: { $in: questionnaireIds.map(id => Types.ObjectId(id)) },
                zombie: { $ne: true },
            });
            if (count !== questionnaireIds.length) {
                throw new NotFoundException('One of the questionnaires does not exist');
            }
        }

        if (bundleIds.length) {
            const count = await this.bundleModel.countDocuments({
                _id: { $in: bundleIds.map(id => Types.ObjectId(id)) },
                deleted: { $ne: true },
            });
            if (count !== bundleIds.length) {
                throw new NotFoundException(
                    'One of the questionnaire bundles does not exist',
                );
            }
        }

        if (schemeIds.length) {
            const count = await this.schemeRepository.count({
                where: {
                    id: In(schemeIds),
                    schemeType: EvaluationSchemeType.INDEPENDENT_EVALUATION,
                },
            });
            if (count !== schemeIds.length) {
                throw new NotFoundException(
                    'One of the fixed evaluation schemes does not exist',
                );
            }
        }
    }

    private async validateItemDepartmentCompatibility(
        items: RandomizationRuleItemInput[],
        departmentIds: number[],
    ): Promise<void> {
        const questionnaireIds = this.uniqueObjectIds(
            items
                .filter(item => item.itemType === RandomizationRuleItemType.QUESTIONNAIRE)
                .map(item => item.questionnaireId),
            'questionnaireId',
        );
        const bundleIds = this.uniqueObjectIds(
            items
                .filter(item => item.itemType === RandomizationRuleItemType.QUESTIONNAIRE_BUNDLE)
                .map(item => item.questionnaireBundleId),
            'questionnaireBundleId',
        );
        const schemeIds = [
            ...new Set(
                items
                    .filter(item => item.itemType === RandomizationRuleItemType.EVALUATION_SCHEME)
                    .map(item => item.evaluationSchemeId)
                    .filter(id => id !== undefined && id !== null),
            ),
        ] as number[];

        if (questionnaireIds.length) {
            const questionnaires = await this.questionnaireModel.find({
                _id: { $in: questionnaireIds.map(id => Types.ObjectId(id)) },
            }).select('_id name departmentIds');
            const incompatibleQuestionnaire = questionnaires.find(questionnaire =>
                !coversAllSelectedDepartments(departmentIds, questionnaire.departmentIds),
            );
            if (incompatibleQuestionnaire) {
                throw new BadRequestException(
                    `Questionnaire "${incompatibleQuestionnaire.name}" is not compatible with the selected randomization departments`,
                );
            }
        }

        if (bundleIds.length) {
            const bundles = await this.bundleModel.find({
                _id: { $in: bundleIds.map(id => Types.ObjectId(id)) },
            }).select('_id name departmentIds');
            const incompatibleBundle = bundles.find(bundle =>
                !coversAllSelectedDepartments(departmentIds, bundle.departmentIds),
            );
            if (incompatibleBundle) {
                throw new BadRequestException(
                    `Questionnaire bundle "${incompatibleBundle.name}" is not compatible with the selected randomization departments`,
                );
            }
        }

        if (schemeIds.length) {
            const schemes = await this.schemeRepository.find({
                where: { id: In(schemeIds) },
                relations: ['departments'],
            });
            const incompatibleScheme = schemes.find(scheme =>
                !coversAllSelectedDepartments(
                    departmentIds,
                    scheme.departments?.map(department => department.id) || [],
                ),
            );
            if (incompatibleScheme) {
                throw new BadRequestException(
                    `Evaluation scheme "${incompatibleScheme.name}" is not compatible with the selected randomization departments`,
                );
            }
        }
    }

    private uniqueObjectIds(values: Array<string | undefined>, field: string): string[] {
        return [
            ...new Set(
                values
                    .filter(value => value !== undefined && value !== null)
                    .map(value => {
                        if (!Types.ObjectId.isValid(value)) {
                            throw new BadRequestException(`${field} is invalid`);
                        }
                        return value as string;
                    }),
            ),
        ];
    }

    private async setDepartments(
        ruleId: number,
        departmentIds: number[] | undefined,
        departmentRepository: Repository<Department>,
        ruleRepository: Repository<RandomizationRule>,
    ): Promise<void> {
        const rule = await ruleRepository.findOne(ruleId, {
            relations: ['departments'],
        });
        if (!rule) throw new NotFoundException('Randomization rule not found');

        const uniqueDepartmentIds = [...new Set(departmentIds || [])];
        rule.departments = uniqueDepartmentIds.length
            ? await departmentRepository.findByIds(uniqueDepartmentIds)
            : [];
        await ruleRepository.save(rule);
    }

    private async replaceItems(
        ruleId: number,
        items: RandomizationRuleItemInput[],
        itemRepository: Repository<RandomizationRuleItem>,
    ): Promise<void> {
        const entities = items.map((item, index) =>
            itemRepository.create({
                randomizationRuleId: ruleId,
                itemType: item.itemType,
                questionnaireId:
                    item.itemType === RandomizationRuleItemType.QUESTIONNAIRE
                        ? item.questionnaireId
                        : null,
                questionnaireBundleId:
                    item.itemType === RandomizationRuleItemType.QUESTIONNAIRE_BUNDLE
                        ? item.questionnaireBundleId
                        : null,
                evaluationSchemeId:
                    item.itemType === RandomizationRuleItemType.EVALUATION_SCHEME
                        ? item.evaluationSchemeId
                        : null,
                weight: Number(item.weight),
                position: item.position === undefined ? index : item.position,
            }),
        );
        await itemRepository.save(entities);
    }
}
