import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Types } from 'mongoose';
import { EvaluationSchemeType } from 'src/modules/evaluation-scheme/enums/evaluation-scheme-type.enum';
import { EvaluationScheme } from 'src/modules/evaluation-scheme/models/evaluation-scheme.model';
import { ResolvedQuestionnaire } from 'src/modules/questionnaire/models/questionnaire-assessment.schema';
import { QuestionnaireBundleResolutionService } from 'src/modules/questionnaire/services/questionnaire-bundle-resolution.service';
import { Repository } from 'typeorm';
import { RandomizationRuleItemType } from '../enums/randomization-rule-item-type.enum';
import { RandomizationRuleType } from '../enums/randomization-rule-type.enum';
import { RandomizationRuleItem } from '../models/randomization-rule-item.model';
import { RandomizationRule } from '../models/randomization-rule.model';

export interface ResolvedRandomization {
    randomizationRuleId: number;
    randomizationRuleName: string;
    randomizationType: RandomizationRuleType;
    selectedItemType: RandomizationRuleItemType;
    selectedItemId: string | number;
    questionnaireIds: Types.ObjectId[];
    questionnaireBundleIds: Types.ObjectId[];
    evaluationSchemeId?: number;
    resolvedQuestionnaires: ResolvedQuestionnaire[];
}

@Injectable()
export class RandomizationResolutionService {
    constructor(
        @InjectRepository(RandomizationRule)
        private readonly ruleRepository: Repository<RandomizationRule>,
        @InjectRepository(EvaluationScheme)
        private readonly schemeRepository: Repository<EvaluationScheme>,
        private readonly bundleResolutionService: QuestionnaireBundleResolutionService,
    ) {}

    async resolveRule(ruleId: number): Promise<ResolvedRandomization> {
        const rule = await this.ruleRepository.findOne(ruleId, {
            relations: ['items'],
        });
        if (!rule) throw new NotFoundException('Randomization rule not found');
        if (rule.active === false) {
            throw new BadRequestException('Randomization rule is inactive');
        }

        const selectedItem = this.weightedSelect(rule.items || []);
        if (!selectedItem) {
            throw new BadRequestException('Randomization rule has no selectable items');
        }

        if (rule.type === RandomizationRuleType.LOW_LEVEL) {
            return this.resolveLowLevelRule(rule, selectedItem);
        }

        return this.resolveHighLevelItem(rule, selectedItem);
    }

    async resolveLowLevelRules(ruleIds: number[] = []): Promise<{
        questionnaireIds: Types.ObjectId[];
        questionnaireBundleIds: Types.ObjectId[];
        resolvedQuestionnaires: ResolvedQuestionnaire[];
        resolvedRandomizations: ResolvedRandomization[];
    }> {
        const resolvedRandomizations: ResolvedRandomization[] = [];
        const questionnaireIds: Types.ObjectId[] = [];
        const questionnaireBundleIds: Types.ObjectId[] = [];
        const resolvedQuestionnaires: ResolvedQuestionnaire[] = [];

        for (const ruleId of ruleIds || []) {
            const resolved = await this.resolveRule(ruleId);
            if (resolved.randomizationType !== RandomizationRuleType.LOW_LEVEL) {
                throw new BadRequestException(
                    'High level randomizations cannot be used as questionnaire resources',
                );
            }

            resolvedRandomizations.push(resolved);
            questionnaireIds.push(...resolved.questionnaireIds);
            questionnaireBundleIds.push(...resolved.questionnaireBundleIds);
            const orderOffset = resolvedQuestionnaires.length;
            resolvedQuestionnaires.push(
                ...resolved.resolvedQuestionnaires.map((questionnaire) => ({
                    ...questionnaire,
                    orderIndex: orderOffset + questionnaire.orderIndex,
                })),
            );
        }

        return {
            questionnaireIds,
            questionnaireBundleIds,
            resolvedQuestionnaires,
            resolvedRandomizations,
        };
    }

    async resolveHighLevelScheme(ruleId: number): Promise<EvaluationScheme> {
        const resolved = await this.resolveRule(ruleId);
        if (resolved.randomizationType !== RandomizationRuleType.HIGH_LEVEL) {
            throw new BadRequestException(
                'Low level randomizations cannot be used as evaluation schemes',
            );
        }

        return this.schemeRepository.findOneOrFail(resolved.evaluationSchemeId);
    }

    private async resolveLowLevelRule(
        rule: RandomizationRule,
        selectedItem: RandomizationRuleItem,
    ): Promise<ResolvedRandomization> {
        if (selectedItem.itemType === RandomizationRuleItemType.QUESTIONNAIRE) {
            const result = await this.bundleResolutionService.resolveQuestionnaireSequence(
                [Types.ObjectId(selectedItem.questionnaireId)],
                [],
            );
            return this.buildResolvedRule(rule, selectedItem, {
                questionnaireIds: result.questionnaireIds,
                questionnaireBundleIds: [],
                resolvedQuestionnaires: result.resolvedQuestionnaires,
            });
        }

        if (selectedItem.itemType === RandomizationRuleItemType.QUESTIONNAIRE_BUNDLE) {
            const bundleId = Types.ObjectId(selectedItem.questionnaireBundleId);
            const result = await this.bundleResolutionService.resolveQuestionnaireSequence(
                [],
                [bundleId],
            );
            return this.buildResolvedRule(rule, selectedItem, {
                questionnaireIds: result.questionnaireIds,
                questionnaireBundleIds: [bundleId],
                resolvedQuestionnaires: result.resolvedQuestionnaires,
            });
        }

        throw new BadRequestException(
            'Low level randomizations only support questionnaires and questionnaire bundles',
        );
    }

    private async resolveHighLevelItem(
        rule: RandomizationRule,
        selectedItem: RandomizationRuleItem,
    ): Promise<ResolvedRandomization> {
        if (selectedItem.itemType !== RandomizationRuleItemType.EVALUATION_SCHEME) {
            throw new BadRequestException(
                'High level randomizations only support fixed evaluation schemes',
            );
        }

        const scheme = await this.schemeRepository.findOne(selectedItem.evaluationSchemeId);
        if (
            !scheme ||
            scheme.active === false ||
            scheme.schemeType !== EvaluationSchemeType.INDEPENDENT_EVALUATION
        ) {
            throw new NotFoundException('Fixed evaluation scheme not found');
        }

        return this.buildResolvedRule(rule, selectedItem, {
            questionnaireIds: [],
            questionnaireBundleIds: [],
            evaluationSchemeId: scheme.id,
            resolvedQuestionnaires: [],
        });
    }

    private buildResolvedRule(
        rule: RandomizationRule,
        selectedItem: RandomizationRuleItem,
        resolved: {
            questionnaireIds: Types.ObjectId[];
            questionnaireBundleIds: Types.ObjectId[];
            evaluationSchemeId?: number;
            resolvedQuestionnaires: ResolvedQuestionnaire[];
        },
    ): ResolvedRandomization {
        return {
            randomizationRuleId: rule.id,
            randomizationRuleName: rule.name,
            randomizationType: rule.type,
            selectedItemType: selectedItem.itemType,
            selectedItemId: this.selectedItemId(selectedItem),
            ...resolved,
        };
    }

    private selectedItemId(item: RandomizationRuleItem): string | number {
        if (item.itemType === RandomizationRuleItemType.QUESTIONNAIRE) {
            return item.questionnaireId;
        }
        if (item.itemType === RandomizationRuleItemType.QUESTIONNAIRE_BUNDLE) {
            return item.questionnaireBundleId;
        }
        return item.evaluationSchemeId;
    }

    private weightedSelect(items: RandomizationRuleItem[]): RandomizationRuleItem | null {
        const candidates = (items || []).filter(item => item.weight > 0);
        if (!candidates.length) return null;

        const totalWeight = candidates.reduce(
            (sum, candidate) => sum + Number(candidate.weight || 1),
            0,
        );
        let cursor = Math.random() * totalWeight;
        const selected = candidates.find(candidate => {
            cursor -= Number(candidate.weight || 1);
            return cursor <= 0;
        });

        return selected || candidates[candidates.length - 1];
    }
}
