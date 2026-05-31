import { Types } from 'mongoose';
import {
    QuestionnaireBundleNodeType,
    QuestionnaireBundleRandomizationMode,
} from '../models/questionnaire-bundle.schema';
import { QuestionnaireStatus } from '../models/questionnaire.schema';
import { QuestionnaireBundleResolutionService } from './questionnaire-bundle-resolution.service';

describe('QuestionnaireBundleResolutionService', () => {
    const questionnaireA = new Types.ObjectId();
    const questionnaireB = new Types.ObjectId();
    const questionnaireC = new Types.ObjectId();
    const questionnaireD = new Types.ObjectId();
    const bundleId = new Types.ObjectId();

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function createService(structure: any[]) {
        const questionnaireBundleModel = {
            findById: jest.fn().mockReturnValue({
                orFail: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue({
                        _id: bundleId,
                        name: 'Clinical intake',
                        structure,
                    }),
                }),
            }),
        };
        const questionnaireModel = {
            findById: jest.fn().mockImplementation(id =>
                Promise.resolve({
                    _id: id,
                    name: `Questionnaire ${id}`,
                    status: QuestionnaireStatus.PUBLISHED,
                }),
            ),
        };

        return new QuestionnaireBundleResolutionService(
            questionnaireBundleModel as any,
            questionnaireModel as any,
        );
    }

    function questionnaireNode(id: Types.ObjectId, nodeId = id.toHexString(), weight?: number) {
        return {
            id: nodeId,
            type: QuestionnaireBundleNodeType.QUESTIONNAIRE,
            questionnaireId: id.toHexString(),
            weight,
        };
    }

    function ids(result: any) {
        return result.questionnaireIds.map(id => id.toHexString());
    }

    it('resolves a simple fixed group in authored order', async () => {
        const service = createService([
            {
                id: 'root',
                type: QuestionnaireBundleNodeType.FIXED_GROUP,
                label: 'Root',
                children: [
                    questionnaireNode(questionnaireA, 'a'),
                    questionnaireNode(questionnaireB, 'b'),
                    questionnaireNode(questionnaireC, 'c'),
                ],
            },
        ]);

        const result = await service.resolveQuestionnaireSequence([], [
            bundleId,
        ] as any);

        expect(ids(result)).toEqual([
            questionnaireA.toHexString(),
            questionnaireB.toHexString(),
            questionnaireC.toHexString(),
        ]);
        expect(result.resolvedQuestionnaires.map(item => item.orderIndex)).toEqual([
            0,
            1,
            2,
        ]);
        expect(result.resolvedQuestionnaires[0].path).toEqual([
            'Clinical intake',
            'Root',
        ]);
    });

    it('randomizes all children in weighted random order', async () => {
        const service = createService([
            {
                id: 'random',
                type: QuestionnaireBundleNodeType.RANDOM_GROUP,
                label: 'Random order',
                randomizationMode: QuestionnaireBundleRandomizationMode.RANDOM_ORDER,
                children: [
                    questionnaireNode(questionnaireA, 'a', 1),
                    questionnaireNode(questionnaireB, 'b', 3),
                    questionnaireNode(questionnaireC, 'c', 1),
                ],
            },
        ]);

        jest.spyOn(Math, 'random')
            .mockReturnValueOnce(0.25)
            .mockReturnValueOnce(0.75)
            .mockReturnValueOnce(0);

        const result = await service.resolveQuestionnaireSequence([], [
            bundleId,
        ] as any);

        expect(ids(result)).toEqual([
            questionnaireB.toHexString(),
            questionnaireC.toHexString(),
            questionnaireA.toHexString(),
        ]);
        expect(result.resolvedQuestionnaires.map(item => item.path)).toEqual([
            ['Clinical intake', 'Random order'],
            ['Clinical intake', 'Random order'],
            ['Clinical intake', 'Random order'],
        ]);
    });

    it('selects one child by default for replacement groups', async () => {
        const service = createService([
            {
                id: 'random',
                type: QuestionnaireBundleNodeType.RANDOM_GROUP,
                label: 'One of two',
                randomizationMode: QuestionnaireBundleRandomizationMode.REPLACEMENT,
                children: [
                    questionnaireNode(questionnaireA, 'a'),
                    questionnaireNode(questionnaireB, 'b'),
                ],
            },
        ]);

        jest.spyOn(Math, 'random').mockReturnValueOnce(0.75);
        const result = await service.resolveQuestionnaireSequence([], [
            bundleId,
        ] as any);

        expect(ids(result)).toEqual([
            questionnaireB.toHexString(),
        ]);
    });

    it('selects the configured number of children for replacement groups', async () => {
        const service = createService([
            {
                id: 'random',
                type: QuestionnaireBundleNodeType.RANDOM_GROUP,
                label: 'Two of four',
                randomizationMode: QuestionnaireBundleRandomizationMode.REPLACEMENT,
                selectionCount: 3,
                children: [
                    questionnaireNode(questionnaireA, 'a'),
                    questionnaireNode(questionnaireB, 'b'),
                    questionnaireNode(questionnaireC, 'c'),
                    questionnaireNode(questionnaireD, 'd'),
                ],
            },
        ]);

        jest.spyOn(Math, 'random')
            .mockReturnValueOnce(0)
            .mockReturnValueOnce(0.5)
            .mockReturnValueOnce(0.99);

        const result = await service.resolveQuestionnaireSequence([], [
            bundleId,
        ] as any);

        expect(ids(result)).toEqual([
            questionnaireA.toHexString(),
            questionnaireC.toHexString(),
            questionnaireD.toHexString(),
        ]);
    });

    it('uses equal probabilities when weights are empty or invalid', async () => {
        const service = createService([
            {
                id: 'random',
                type: QuestionnaireBundleNodeType.RANDOM_GROUP,
                label: 'Empty weights',
                randomizationMode: QuestionnaireBundleRandomizationMode.REPLACEMENT,
                children: [
                    questionnaireNode(questionnaireA, 'a', null as any),
                    questionnaireNode(questionnaireB, 'b', 0),
                    questionnaireNode(questionnaireC, 'c', undefined),
                ],
            },
        ]);

        jest.spyOn(Math, 'random').mockReturnValueOnce(0.5);
        const result = await service.resolveQuestionnaireSequence([], [
            bundleId,
        ] as any);

        expect(ids(result)).toEqual([
            questionnaireB.toHexString(),
        ]);
    });

    it('keeps repeated questionnaires as separate occurrences', async () => {
        const service = createService([
            {
                id: 'root',
                type: QuestionnaireBundleNodeType.FIXED_GROUP,
                label: 'Repeat root',
                children: [
                    questionnaireNode(questionnaireA, 'a'),
                    questionnaireNode(questionnaireB, 'b'),
                    questionnaireNode(questionnaireA, 'a-repeat'),
                ],
            },
        ]);

        const result = await service.resolveQuestionnaireSequence([], [
            bundleId,
        ] as any);

        expect(ids(result)).toEqual([
            questionnaireA.toHexString(),
            questionnaireB.toHexString(),
            questionnaireA.toHexString(),
        ]);
        expect(result.resolvedQuestionnaires[0].occurrenceId).not.toEqual(
            result.resolvedQuestionnaires[2].occurrenceId,
        );
    });

    it('resolves deeply nested fixed and randomized groups with full paths', async () => {
        const service = createService([
            {
                id: 'level-1',
                type: QuestionnaireBundleNodeType.FIXED_GROUP,
                label: 'Level 1',
                children: [
                    {
                        id: 'level-2',
                        type: QuestionnaireBundleNodeType.RANDOM_GROUP,
                        label: 'Level 2',
                        randomizationMode: QuestionnaireBundleRandomizationMode.REPLACEMENT,
                        selectionCount: 1,
                        children: [
                            questionnaireNode(questionnaireA, 'a'),
                            {
                                id: 'level-3',
                                type: QuestionnaireBundleNodeType.FIXED_GROUP,
                                label: 'Level 3',
                                children: [
                                    {
                                        id: 'level-4',
                                        type: QuestionnaireBundleNodeType.FIXED_GROUP,
                                        label: 'Level 4',
                                        children: [
                                            questionnaireNode(questionnaireB, 'b'),
                                            questionnaireNode(questionnaireC, 'c'),
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ]);

        jest.spyOn(Math, 'random').mockReturnValueOnce(0.99);
        const result = await service.resolveQuestionnaireSequence([], [
            bundleId,
        ] as any);

        expect(ids(result)).toEqual([
            questionnaireB.toHexString(),
            questionnaireC.toHexString(),
        ]);
        expect(result.resolvedQuestionnaires.map(item => item.path)).toEqual([
            ['Clinical intake', 'Level 1', 'Level 2', 'Level 3', 'Level 4'],
            ['Clinical intake', 'Level 1', 'Level 2', 'Level 3', 'Level 4'],
        ]);
    });
});
