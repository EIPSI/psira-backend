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
import { BadRequestException, NotFoundException } from '@nestjs/common';

export class QuestionnaireBundleService {
    constructor(
        @InjectModel(QuestionnaireBundle.name)
        private questionnaireBundleModel: Model<QuestionnaireBundle>,
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
        const departments = await Department.count({ where: { id: In(departmentIds) }});

        if (departmentIds.length !== departments) {
            throw new NotFoundException('One of the departments does not exist!')
        }

        const newQuestionnaireBundle = new this.questionnaireBundleModel();
        const structure = this.structureFromInput(input);
        newQuestionnaireBundle.name = input.name;
        newQuestionnaireBundle.structure = structure;
        newQuestionnaireBundle.structureJson = JSON.stringify(structure);
        newQuestionnaireBundle.departmentIds = departmentIds;
        newQuestionnaireBundle.active = input.active !== false;
        newQuestionnaireBundle.author = currentUser.id
        const questionnaire = await newQuestionnaireBundle.save()

        return this.getById(questionnaire._id)
    }

    async list(query: QuestionniareBundleQuery, departmentIds: number[]) {
        const findQuery: FilterQuery<QuestionnaireBundle> = { deleted: { $ne: true } }

        if (!!departmentIds) {
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

    async updateQuestionnaireBundle(input: UpdateQuestionnaireBundleInput) {
        const { _id, ...restInput } = input;
        const id = Types.ObjectId(_id);
        const questionnaireBundle = await this.questionnaireBundleModel.findById(
            id,
        );

        if (!questionnaireBundle) {
            throw new NotFoundException();
        }

        const departmentIds = input.departmentIds || [];
        const departments = await Department.count({ where: { id: In(departmentIds) }});

        if (departmentIds.length !== departments) {
            throw new NotFoundException('One of the departments does not exist!')
        }

        const structure = this.structureFromInput(restInput);
        questionnaireBundle.name = restInput.name;
        questionnaireBundle.structure = structure;
        questionnaireBundle.structureJson = JSON.stringify(structure);
        questionnaireBundle.departmentIds = departmentIds;
        questionnaireBundle.active = restInput.active !== false;
        questionnaireBundle.markModified('structure');

        await questionnaireBundle.save();

        return this.getById(id)
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
}
