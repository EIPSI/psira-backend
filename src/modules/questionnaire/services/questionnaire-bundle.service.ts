import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import {
    CreateQuestionnaireBundleInput, UpdateQuestionnaireBundleInput,
} from '../dtos/questionnaire-bundle.input';
import { QuestionnaireBundle } from '../models/questionnaire-bundle.schema';
import { Questionnaire } from '../models/questionnaire.schema';
import { QuestionniareBundleQuery } from '../resolvers/questionnaire-bundle.resolver';
import { applyQuery } from '@nestjs-query/core';
import { User } from 'src/modules/user/models/user.model';
import { Department } from 'src/modules/department/models/department.model';
import { In } from 'typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserDepartmentAccessService, DepartmentAccessScope } from 'src/modules/user/services/user-department-access.service';
import {
    areDepartmentsCompatible,
    coversAllSelectedDepartments,
} from 'src/shared/department-compatibility';

export class QuestionnaireBundleService {
    constructor(
        @InjectModel(QuestionnaireBundle.name)
        private questionnaireBundleModel: Model<QuestionnaireBundle>,
        private userDepartmentAccessService: UserDepartmentAccessService,
    ) {}

    getById(_id: Types.ObjectId) {
        return this.questionnaireBundleModel
            .findById(_id)
            .populate({
                path: 'structure.questionnaireId',
                model: Questionnaire.name,
            })
            .exec();
    }

    async createQuestionnaireBundle(input: CreateQuestionnaireBundleInput, currentUser: User) {

        const departmentIds = input.departmentIds || [];
        await this.validateDepartmentAccess(currentUser, departmentIds);

        const newQuestionnaireBundle = new this.questionnaireBundleModel();
        const structure = this.structureFromInput(input);
        await this.validateStructureDepartments(structure, departmentIds);
        newQuestionnaireBundle.name = input.name;
        newQuestionnaireBundle.structure = structure;
        newQuestionnaireBundle.structureJson = JSON.stringify(structure);
        newQuestionnaireBundle.departmentIds = departmentIds;
        newQuestionnaireBundle.active = input.active !== false;
        newQuestionnaireBundle.author = currentUser.id
        const questionnaire = await newQuestionnaireBundle.save()

        return this.getById(questionnaire._id)
    }

    async list(query: QuestionniareBundleQuery, departmentIds: number[], currentUser: User) {
        const findQuery: FilterQuery<QuestionnaireBundle> = { deleted: { $ne: true } }
        const access = await this.userDepartmentAccessService.getUserDepartmentAccess(currentUser.id);

        if (access.scope !== DepartmentAccessScope.ALL) {
            findQuery.$or = [
                { departmentIds: { $in: access.departmentIds || [] } },
                { departmentIds: { $exists: false } },
                { departmentIds: { $size: 0 } },
            ];
        }

        if (departmentIds?.length) {
            findQuery.departmentIds = { $in: departmentIds }
        }

        const questionnaireBundles: QuestionnaireBundle[] = await this.questionnaireBundleModel
            .find(findQuery)
            .populate({
                path: 'structure.questionnaireId',
                model: Questionnaire.name,
            });

        return applyQuery(questionnaireBundles, query);
    }

    async deleteQuestionnaireBundle(id: string) {
        const _id = Types.ObjectId(id);

        const questionnaireBundle = await this.questionnaireBundleModel.findById(_id)

        questionnaireBundle.deleted = true;

        return questionnaireBundle.save();
    }

    async updateQuestionnaireBundle(input: UpdateQuestionnaireBundleInput, currentUser?: User) {
        const { _id, ...restInput } = input;
        const id = Types.ObjectId(_id);
        const questionnaireBundle = await this.questionnaireBundleModel.findById(
            id,
        );

        if (!questionnaireBundle) {
            throw new NotFoundException();
        }

        const departmentIds = input.departmentIds || [];
        if (currentUser) {
            await this.validateDepartmentAccess(currentUser, departmentIds);
        } else {
            await this.validateDepartmentsExist(departmentIds);
        }

        const structure = this.structureFromInput(restInput);
        await this.validateStructureDepartments(structure, departmentIds);
        questionnaireBundle.name = restInput.name;
        questionnaireBundle.structure = structure;
        questionnaireBundle.structureJson = JSON.stringify(structure);
        questionnaireBundle.departmentIds = departmentIds;
        questionnaireBundle.active = restInput.active !== false;
        questionnaireBundle.markModified('structure');

        await questionnaireBundle.save();

        return this.getById(id)
    }

    private async validateDepartmentAccess(
        currentUser: User,
        departmentIds: number[],
    ): Promise<void> {
        await this.validateDepartmentsExist(departmentIds);
        const canAccess = await this.userDepartmentAccessService.canAccessDepartments(
            currentUser.id,
            [...new Set(departmentIds || [])],
        );
        if (!canAccess) {
            throw new ForbiddenException('Cannot assign questionnaire bundle to these departments');
        }
    }

    private async validateDepartmentsExist(departmentIds: number[]): Promise<void> {
        const uniqueDepartmentIds = [...new Set(departmentIds || [])];
        if (!uniqueDepartmentIds.length) return;
        const departments = await Department.count({ where: { id: In(uniqueDepartmentIds) }});

        if (uniqueDepartmentIds.length !== departments) {
            throw new NotFoundException('One of the departments does not exist!')
        }
    }

    private structureFromInput(input: Pick<CreateQuestionnaireBundleInput, 'structure' | 'structureJson'>) {
        if (input.structureJson) {
            try {
                return JSON.parse(input.structureJson);
            } catch {
                throw new BadRequestException('Invalid questionnaire bundle structure');
            }
        }

        return input.structure || [];
    }

    private async validateStructureDepartments(structure: any[], departmentIds: number[]): Promise<void> {
        const questionnaireIds = this.extractQuestionnaireIds(structure);
        if (!questionnaireIds.length) return;

        const questionnaires = await this.questionnaireBundleModel.db
            .model<Questionnaire>(Questionnaire.name)
            .find({
                _id: { $in: questionnaireIds.map(id => Types.ObjectId(id)) },
                zombie: { $ne: true },
            })
            .select('_id departmentIds name')
            .exec();

        if (questionnaires.length !== questionnaireIds.length) {
            throw new NotFoundException('One of the questionnaires does not exist');
        }

        const incompatibleQuestionnaire = questionnaires.find(questionnaire =>
            !coversAllSelectedDepartments(departmentIds, questionnaire.departmentIds),
        );
        if (incompatibleQuestionnaire) {
            throw new BadRequestException(
                `Questionnaire "${incompatibleQuestionnaire.name}" is not compatible with the selected bundle departments`,
            );
        }
    }

    private extractQuestionnaireIds(nodes: any[] = []): string[] {
        const ids = nodes.reduce((acc: string[], node: any) => {
            if (node?.questionnaireId) {
                acc.push(String(node.questionnaireId));
            }
            return [...acc, ...this.extractQuestionnaireIds(node?.children || [])];
        }, []);

        return [...new Set<string>(ids)].filter(id => Types.ObjectId.isValid(id));
    }
}
