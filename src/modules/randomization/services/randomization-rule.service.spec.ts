import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { Department } from 'src/modules/department/models/department.model';
import { RandomizationRuleItemType } from '../enums/randomization-rule-item-type.enum';
import { RandomizationRuleType } from '../enums/randomization-rule-type.enum';
import { RandomizationRuleItem } from '../models/randomization-rule-item.model';
import { RandomizationRule } from '../models/randomization-rule.model';
import { RandomizationRuleService } from './randomization-rule.service';

describe('RandomizationRuleService', () => {
    const questionnaireId = new Types.ObjectId().toHexString();
    const bundleId = new Types.ObjectId().toHexString();

    function createRepositoryMocks() {
        const departmentRepository = {
            count: jest.fn().mockResolvedValue(0),
            findByIds: jest.fn().mockResolvedValue([{ id: 1, name: 'Clinical' }]),
        };
        const schemeRepository = {
            count: jest.fn().mockResolvedValue(0),
        };
        const questionnaireModel = {
            countDocuments: jest.fn().mockResolvedValue(0),
        };
        const bundleModel = {
            countDocuments: jest.fn().mockResolvedValue(0),
        };
        const itemRepository = {
            create: jest.fn((value: any) => value),
            save: jest.fn().mockResolvedValue([]),
        };
        const ruleRelationRepository = {
            findOne: jest.fn().mockResolvedValue({ id: 1, departments: [] }),
            save: jest.fn().mockResolvedValue({ id: 1 }),
        };
        const ruleRepository = {
            findOne: jest.fn().mockResolvedValue({
                id: 1,
                name: 'Baseline randomization',
                type: RandomizationRuleType.LOW_LEVEL,
                active: true,
                departments: [{ id: 1, name: 'Clinical' }],
                items: [
                    {
                        id: 1,
                        itemType: RandomizationRuleItemType.QUESTIONNAIRE,
                        questionnaireId,
                        weight: 1,
                        position: 0,
                    },
                    {
                        id: 2,
                        itemType: RandomizationRuleItemType.QUESTIONNAIRE_BUNDLE,
                        questionnaireBundleId: bundleId,
                        weight: 2,
                        position: 1,
                    },
                ],
            }),
            delete: jest.fn().mockResolvedValue({}),
            save: jest.fn((rule: any) => Promise.resolve(rule)),
            manager: {
                create: jest.fn((_entity: any, value: any) => value),
                save: jest.fn((_entity: any, value: any) =>
                    Promise.resolve({ ...value, id: 1 }),
                ),
                delete: jest.fn().mockResolvedValue({}),
                findOne: jest.fn().mockResolvedValue({ id: 1, active: true }),
                getRepository: jest.fn((entity: any) => {
                    if (entity === Department) return departmentRepository;
                    if (entity === RandomizationRule) return ruleRelationRepository;
                    if (entity === RandomizationRuleItem) return itemRepository;
                    return {};
                }),
                transaction: jest.fn((callback: any) =>
                    callback(ruleRepository.manager),
                ),
            },
        };

        const service = new RandomizationRuleService(
            ruleRepository as any,
            itemRepository as any,
            departmentRepository as any,
            schemeRepository as any,
            questionnaireModel as any,
            bundleModel as any,
        );

        return {
            service,
            ruleRepository,
            itemRepository,
            departmentRepository,
            schemeRepository,
            questionnaireModel,
            bundleModel,
        };
    }

    it('creates a low-level randomization with questionnaires and bundles', async () => {
        const {
            service,
            ruleRepository,
            itemRepository,
            departmentRepository,
            questionnaireModel,
            bundleModel,
        } = createRepositoryMocks();
        departmentRepository.count.mockResolvedValue(1);
        questionnaireModel.countDocuments.mockResolvedValue(1);
        bundleModel.countDocuments.mockResolvedValue(1);

        const result = await service.createRule({
            name: 'Baseline randomization',
            type: RandomizationRuleType.LOW_LEVEL,
            active: true,
            departmentIds: [1],
            items: [
                {
                    itemType: RandomizationRuleItemType.QUESTIONNAIRE,
                    questionnaireId,
                    weight: 1,
                },
                {
                    itemType: RandomizationRuleItemType.QUESTIONNAIRE_BUNDLE,
                    questionnaireBundleId: bundleId,
                    weight: 2,
                },
            ],
        });

        expect(result.id).toBe(1);
        expect(ruleRepository.manager.transaction).toHaveBeenCalled();
        expect(itemRepository.save).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    itemType: RandomizationRuleItemType.QUESTIONNAIRE,
                    questionnaireId,
                    weight: 1,
                    position: 0,
                }),
                expect.objectContaining({
                    itemType: RandomizationRuleItemType.QUESTIONNAIRE_BUNDLE,
                    questionnaireBundleId: bundleId,
                    weight: 2,
                    position: 1,
                }),
            ]),
        );
    });

    it('rejects high-level randomizations that include low-level items', async () => {
        const { service, questionnaireModel } = createRepositoryMocks();
        questionnaireModel.countDocuments.mockResolvedValue(1);

        await expect(
            service.createRule({
                name: 'Wrong level',
                type: RandomizationRuleType.HIGH_LEVEL,
                items: [
                    {
                        itemType: RandomizationRuleItemType.QUESTIONNAIRE,
                        questionnaireId,
                        weight: 1,
                    },
                    {
                        itemType: RandomizationRuleItemType.QUESTIONNAIRE,
                        questionnaireId: new Types.ObjectId().toHexString(),
                        weight: 1,
                    },
                ],
            }),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects low-level randomizations that include schemes', async () => {
        const { service } = createRepositoryMocks();

        await expect(
            service.createRule({
                name: 'Wrong level',
                type: RandomizationRuleType.LOW_LEVEL,
                items: [
                    {
                        itemType: RandomizationRuleItemType.EVALUATION_SCHEME,
                        evaluationSchemeId: 1,
                        weight: 1,
                    },
                    {
                        itemType: RandomizationRuleItemType.EVALUATION_SCHEME,
                        evaluationSchemeId: 2,
                        weight: 1,
                    },
                ],
            }),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects duplicated items', async () => {
        const { service } = createRepositoryMocks();

        await expect(
            service.createRule({
                name: 'Duplicated',
                type: RandomizationRuleType.LOW_LEVEL,
                items: [
                    {
                        itemType: RandomizationRuleItemType.QUESTIONNAIRE,
                        questionnaireId,
                        weight: 1,
                    },
                    {
                        itemType: RandomizationRuleItemType.QUESTIONNAIRE,
                        questionnaireId,
                        weight: 1,
                    },
                ],
            }),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects invalid weights', async () => {
        const { service } = createRepositoryMocks();

        await expect(
            service.createRule({
                name: 'Invalid weights',
                type: RandomizationRuleType.LOW_LEVEL,
                items: [
                    {
                        itemType: RandomizationRuleItemType.QUESTIONNAIRE,
                        questionnaireId,
                        weight: 0,
                    },
                    {
                        itemType: RandomizationRuleItemType.QUESTIONNAIRE_BUNDLE,
                        questionnaireBundleId: bundleId,
                        weight: 1,
                    },
                ],
            }),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects missing fixed schemes for high-level randomizations', async () => {
        const { service, schemeRepository } = createRepositoryMocks();
        schemeRepository.count.mockResolvedValue(1);

        await expect(
            service.createRule({
                name: 'Missing scheme',
                type: RandomizationRuleType.HIGH_LEVEL,
                items: [
                    {
                        itemType: RandomizationRuleItemType.EVALUATION_SCHEME,
                        evaluationSchemeId: 1,
                        weight: 1,
                    },
                    {
                        itemType: RandomizationRuleItemType.EVALUATION_SCHEME,
                        evaluationSchemeId: 2,
                        weight: 1,
                    },
                ],
            }),
        ).rejects.toBeInstanceOf(NotFoundException);
    });
});
