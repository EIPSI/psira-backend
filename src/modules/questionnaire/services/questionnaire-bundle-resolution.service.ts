import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
    Questionnaire,
    QuestionnaireStatus,
} from '../models/questionnaire.schema';
import {
    QuestionnaireBundle,
    QuestionnaireBundleNode,
    QuestionnaireBundleNodeType,
    QuestionnaireBundleRandomizationMode,
} from '../models/questionnaire-bundle.schema';
import { ResolvedQuestionnaire } from '../models/questionnaire-assessment.schema';

interface BundleScreenContext {
    id: string;
    label?: string;
    headerHtml?: string;
    footerHtml?: string;
    index: number;
}

interface BundlePresentationContext {
    headerHtml?: string;
    noticeHtml?: string;
}

@Injectable()
export class QuestionnaireBundleResolutionService {
    constructor(
        @InjectModel(QuestionnaireBundle.name)
        private questionnaireBundleModel: Model<QuestionnaireBundle>,
        @InjectModel(Questionnaire.name)
        private questionnaireModel: Model<Questionnaire>,
    ) {}

    async resolveQuestionnaireSequence(
        questionnaires: Types.ObjectId[] = [],
        questionnaireBundles: Types.ObjectId[] = [],
    ): Promise<{
        questionnaireIds: Types.ObjectId[];
        resolvedQuestionnaires: ResolvedQuestionnaire[];
    }> {
        const resolvedQuestionnaires: ResolvedQuestionnaire[] = [];
        const screenState = { nextScreenIndex: 0 };

        for (const questionnaireId of questionnaires || []) {
            await this.assertQuestionnaireCanBeUsed(questionnaireId);
            resolvedQuestionnaires.push(
                this.createResolvedQuestionnaire(questionnaireId, null, [], resolvedQuestionnaires.length),
            );
        }

        for (const bundleId of questionnaireBundles || []) {
            const bundle = await this.questionnaireBundleModel
                .findById(bundleId)
                .orFail()
                .exec();

            const bundlePath = [bundle.name].filter(Boolean);
            const bundlePresentation: BundlePresentationContext = {
                headerHtml: bundle.headerHtml,
                noticeHtml: bundle.noticeHtml,
            };
            const bundleQuestionnaires = await this.resolveNodes(
                this.structureForBundle(bundle),
                bundle._id,
                bundlePath,
                screenState,
                bundlePresentation,
            );

            for (const resolvedQuestionnaire of bundleQuestionnaires) {
                resolvedQuestionnaire.orderIndex = resolvedQuestionnaires.length;
                resolvedQuestionnaires.push(resolvedQuestionnaire);
            }
        }

        return {
            questionnaireIds: resolvedQuestionnaires.map(resolved =>
                Types.ObjectId(resolved.questionnaireId as string),
            ),
            resolvedQuestionnaires,
        };
    }

    private structureForBundle(bundle: QuestionnaireBundle): QuestionnaireBundleNode[] {
        if (bundle.structure?.length) {
            return bundle.structure;
        }

        if (!bundle.structureJson) {
            return [];
        }

        try {
            return JSON.parse(bundle.structureJson);
        } catch {
            throw new BadRequestException(`Invalid structure for questionnaire bundle "${bundle.name}"`);
        }
    }

    private async resolveNodes(
        nodes: QuestionnaireBundleNode[],
        sourceBundleId: Types.ObjectId,
        path: string[],
        screenState: { nextScreenIndex: number },
        bundlePresentation?: BundlePresentationContext,
        screen?: BundleScreenContext,
    ): Promise<ResolvedQuestionnaire[]> {
        const resolvedQuestionnaires: ResolvedQuestionnaire[] = [];

        for (const node of nodes || []) {
            resolvedQuestionnaires.push(
                ...(await this.resolveNode(node, sourceBundleId, path, screenState, bundlePresentation, screen)),
            );
        }

        return resolvedQuestionnaires;
    }

    private async resolveNode(
        node: QuestionnaireBundleNode,
        sourceBundleId: Types.ObjectId,
        path: string[],
        screenState: { nextScreenIndex: number },
        bundlePresentation?: BundlePresentationContext,
        screen?: BundleScreenContext,
    ): Promise<ResolvedQuestionnaire[]> {
        if (!node?.type) {
            throw new BadRequestException('Bundle node type is required');
        }

        if (node.type === QuestionnaireBundleNodeType.QUESTIONNAIRE) {
            if (!node.questionnaireId) {
                throw new BadRequestException('Questionnaire node must include questionnaireId');
            }
            await this.assertQuestionnaireCanBeUsed(node.questionnaireId);
            return [
                this.createResolvedQuestionnaire(
                    node.questionnaireId,
                    sourceBundleId,
                    path,
                    0,
                    bundlePresentation,
                    screen,
                    node,
                ),
            ];
        }

        const children = node.children || [];
        if (!children.length) {
            throw new BadRequestException('Bundle groups must include children');
        }

        const nextPath = node.label ? [...path, node.label] : path;

        if (node.type === QuestionnaireBundleNodeType.SCREEN) {
            const nextScreen: BundleScreenContext = {
                id: node.id,
                label: node.displayTitle || '',
                headerHtml: node.headerHtml,
                footerHtml: node.footerHtml,
                index: screenState.nextScreenIndex++,
            };
            return this.resolveNodes(children, sourceBundleId, nextPath, screenState, bundlePresentation, nextScreen);
        }

        if (node.type === QuestionnaireBundleNodeType.FIXED_GROUP) {
            return this.resolveNodes(children, sourceBundleId, nextPath, screenState, bundlePresentation, screen);
        }

        if (node.type === QuestionnaireBundleNodeType.RANDOM_GROUP) {
            const mode =
                node.randomizationMode ||
                QuestionnaireBundleRandomizationMode.RANDOM_ORDER;
            const selectedChildren =
                mode === QuestionnaireBundleRandomizationMode.REPLACEMENT
                    ? this.weightedSelect(children, node.selectionCount || 1)
                    : this.weightedSelect(children, children.length);

            return this.resolveNodes(selectedChildren, sourceBundleId, nextPath, screenState, bundlePresentation, screen);
        }

        throw new BadRequestException(`Unsupported bundle node type "${node.type}"`);
    }

    private weightedSelect(
        nodes: QuestionnaireBundleNode[],
        requestedCount: number,
    ): QuestionnaireBundleNode[] {
        const candidates = [...nodes];
        const selected: QuestionnaireBundleNode[] = [];
        const count = Math.min(Math.max(requestedCount || 1, 1), candidates.length);

        while (selected.length < count && candidates.length) {
            const totalWeight = candidates.reduce(
                (sum, candidate) => sum + this.weightForNode(candidate),
                0,
            );
            let cursor = Math.random() * totalWeight;
            const selectedIndex = candidates.findIndex(candidate => {
                cursor -= this.weightForNode(candidate);
                return cursor <= 0;
            });
            const index = selectedIndex >= 0 ? selectedIndex : candidates.length - 1;
            selected.push(candidates[index]);
            candidates.splice(index, 1);
        }

        return selected;
    }

    private weightForNode(node: QuestionnaireBundleNode): number {
        return Number.isFinite(node.weight) && node.weight > 0 ? node.weight : 1;
    }

    private createResolvedQuestionnaire(
        questionnaireId: Types.ObjectId | string,
        sourceBundleId: Types.ObjectId | null,
        path: string[],
        orderIndex: number,
        bundlePresentation?: BundlePresentationContext,
        screen?: BundleScreenContext,
        node?: QuestionnaireBundleNode,
    ): ResolvedQuestionnaire {
        return {
            occurrenceId: new Types.ObjectId().toHexString(),
            questionnaireId: questionnaireId.toString(),
            sourceBundleId: sourceBundleId ? sourceBundleId.toString() : null,
            path,
            screenId: screen?.id,
            screenLabel: screen?.label,
            screenHeaderHtml: screen?.headerHtml,
            screenFooterHtml: screen?.footerHtml,
            bundleHeaderHtml: bundlePresentation?.headerHtml,
            bundleNoticeHtml: bundlePresentation?.noticeHtml,
            questionnaireDisplayTitle: node?.displayTitle,
            showQuestionnaireTitle: node?.showTitle,
            screenIndex: screen?.index,
            orderIndex,
        };
    }

    private async assertQuestionnaireCanBeUsed(questionnaireId: Types.ObjectId | string) {
        const questionnaire = await this.questionnaireModel.findById(questionnaireId);

        if (!questionnaire) {
            throw new NotFoundException('Questionnaire not found');
        }

        if (
            ![
                QuestionnaireStatus.PRIVATE,
                QuestionnaireStatus.PUBLISHED,
            ].includes(questionnaire.status)
        ) {
            throw new BadRequestException(
                `${questionnaire.name} has status ${questionnaire.status} and cannot be added to assessment.`,
            );
        }
    }
}
