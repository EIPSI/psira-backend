import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
    CreateQuestionnaireInput,
    UpdateQuestionnaireInput,
} from '../dtos/questionnaire.input';
import { Questionnaire, QuestionnaireStatus } from '../models/questionnaire.schema';

import xlsx from 'node-xlsx';
import { Question, QuestionType } from '../models/question.schema';
import { QuestionGroup } from '../models/question-group.schema';
import { XLSForm } from '../helpers/xlsform-reader.helper';
import { XlsFormQuestionFactory } from '../helpers/xlsform-questions.factory';
import { FileUpload } from 'graphql-upload';
import { applyQuery } from '@nestjs-query/core';
import { QuestionniareQuery } from '../resolvers/questionnaire.resolver';
import { FileData } from '../dtos/xlsform.dto';
import { Department } from 'src/modules/department/models/department.model';
import { In } from 'typeorm';
import { User } from 'src/modules/user/models/user.model';
import {
    DepartmentAccessScope,
    UserDepartmentAccessService,
} from 'src/modules/user/services/user-department-access.service';

@Injectable()
export class QuestionnaireService {
    private questionnaireIndexesReady: Promise<void>;
    constructor(
        @InjectModel(Questionnaire.name)
        private questionnaireModel: Model<Questionnaire>,
        @InjectModel(QuestionGroup.name)
        private questionGroupModel: Model<QuestionGroup>,
        @InjectModel(Question.name)
        private questionModel: Model<Question>,
        private userDepartmentAccessService: UserDepartmentAccessService,
    ) {}

    public async create(xlsForm: CreateQuestionnaireInput | any, currentUser: User) {
        await this.ensureQuestionnaireVersionIndexes();
        const questionnaireInput = this.extractQuestionnaireInput(xlsForm);
        await this.validateDepartmentAccess(currentUser, questionnaireInput.departmentIds || []);
        const fileData: FileData[] = await this.readFileUpload(
            await this.extractQuestionnaireUpload(questionnaireInput),
        );

        const questionnaire = await this.createQuestionnaireFromFileData(fileData, questionnaireInput);
        questionnaire.versionRootId = questionnaire._id.toString();
        questionnaire.versionNumber = 1;
        questionnaire.replacedById = null;
        return questionnaire.save();
    }

    public async updateOne(
        _id: Types.ObjectId,
        xlsForm: UpdateQuestionnaireInput | any,
        currentUser: User,
    ) {
        await this.ensureQuestionnaireVersionIndexes();
        const questionnaireInput = this.extractQuestionnaireInput(xlsForm) as UpdateQuestionnaireInput;
        await this.validateDepartmentAccess(currentUser, questionnaireInput.departmentIds || []);
        const version = await this.questionnaireModel.findById(_id);

        if (!version) {
            throw new NotFoundException('Questionnaire not found');
        }

        const excelFile = await this.extractOptionalQuestionnaireUpload(questionnaireInput);
        if (excelFile) {
            return this.createNewVersionFromUpload(version, questionnaireInput, excelFile);
        }

        const { excelFile: ignoredFile, ...metadata } = questionnaireInput as any;
        Object.entries(metadata).forEach(
            ([key, value]) => (version[key] = value),
        );
        if (!version.versionRootId) version.versionRootId = version._id.toString();
        if (!version.versionNumber) version.versionNumber = 1;

        return version.save();
    }

    public async getById(questionnaireId: Types.ObjectId) {
        return this.questionnaireModel.findOne({ _id: questionnaireId })
    }

    async list(query: QuestionniareQuery, currentUser: User, departmentIds: number[] = []) {
        const access = await this.userDepartmentAccessService.getUserDepartmentAccess(currentUser.id);
        const scopeMatch = access.scope === DepartmentAccessScope.ALL
            ? {}
            : {
                $or: [
                    { departmentIds: { $in: access.departmentIds || [] } },
                    { departmentIds: { $exists: false } },
                    { departmentIds: { $size: 0 } },
                ],
            };
        const explicitDepartmentIds = [...new Set(departmentIds || [])];
        const selectedDepartmentsMatch = explicitDepartmentIds.length
            ? {
                $or: [
                    { departmentIds: { $in: explicitDepartmentIds } },
                    { departmentIds: { $exists: false } },
                    { departmentIds: { $size: 0 } },
                ],
            }
            : {};
        const matchConditions = [scopeMatch, selectedDepartmentsMatch]
            .filter(condition => Object.keys(condition).length);
        const match = matchConditions.length ? { $and: matchConditions } : {};
        const questionnaires: Questionnaire[] = (
            await this.questionnaireModel.aggregate().match(match).group({
                _id: '$_id',
                createdAt: {
                    $last: '$createdAt',
                },
                status: {
                    $last: '$status',
                },
                name: {
                    $last: '$name',
                },
                website: {
                    $last: '$website',
                },
                keywords: {
                    $last: '$keywords',
                },
                copyright: {
                    $last: '$copyright',
                },
                license: {
                    $last: '$license',
                },
                timeToComplete: {
                    $last: '$timeToComplete',
                },
                questionGroups: {
                    $last: '$questionGroups',
                },
                description: {
                    $last: '$description'
                },
                language: {
                    $last: '$language'
                },
                abbreviation: {
                    $last: '$abbreviation'
                },
                departmentIds: {
                    $last: '$departmentIds'
                },
                versionRootId: {
                    $last: '$versionRootId'
                },
                versionNumber: {
                    $last: '$versionNumber'
                },
                replacedById: {
                    $last: '$replacedById'
                },
                zombie: {
                    $last: '$zombie'
                }
            })
        );

        return applyQuery(questionnaires, query);
    }

    async deleteQuestionnaire(_id: Types.ObjectId) {
        const version = await this.getById(_id)

        if (version.zombie) {
            throw new Error('Questionnaire is already discarded.');
        }

        version.zombie = true;

        return version.save();
    }

    private findUniqueQuestionnaire(
        language: string,
        abbreviation: string,
    ): Promise<Questionnaire> {
        return this.questionnaireModel
            .findOne({
                language: language,
                abbreviation: abbreviation,
                zombie: { $ne: true }
            })
            .exec()
    }

    private async createQuestionnaireFromFileData(
        fileData: FileData[],
        questionnaireInput: CreateQuestionnaireInput,
        options: { skipUniqueCheck?: boolean; deferSave?: boolean } = {},
    ) {
        const xlsFormParsed: XLSForm = new XLSForm(fileData);
        const settings = xlsFormParsed.getSettings();

        if (!options.skipUniqueCheck &&
            await this.findUniqueQuestionnaire(
                questionnaireInput.language,
                settings.form_id,
            )
        ) {
            throw new Error(
                `A questionnaire for '${settings.form_id}' already exists in language '${questionnaireInput.language}'.`,
            );
        }

        const createdQuestionnaire = new this.questionnaireModel();

        createdQuestionnaire.name =
            questionnaireInput.name ?? settings.form_title;

        createdQuestionnaire.license = questionnaireInput.license;

        createdQuestionnaire.copyright = questionnaireInput.copyright;
        createdQuestionnaire.timeToComplete =
            questionnaireInput.timeToComplete;
        createdQuestionnaire.website = questionnaireInput.website;
        createdQuestionnaire.status =
            questionnaireInput.status ?? QuestionnaireStatus.DRAFT;

        createdQuestionnaire.keywords = questionnaireInput.keywords;

        createdQuestionnaire.language = questionnaireInput.language;
        createdQuestionnaire.abbreviation = settings.form_id;
        createdQuestionnaire.description = questionnaireInput.description;
        createdQuestionnaire.departmentIds = questionnaireInput.departmentIds || [];
        createdQuestionnaire.zombie = false;

        let currentGroup: QuestionGroup = null;

        for (const questionData of xlsFormParsed.getQuestionData()) {
            if (questionData.type === QuestionType.END_GROUP) {
                currentGroup && createdQuestionnaire.questionGroups.push(currentGroup);
                currentGroup = null;
            } else {
                const question = XlsFormQuestionFactory.createQuestion(
                    questionData,
                    xlsFormParsed,
                    new this.questionModel(),
                    new this.questionGroupModel(),
                );

                if ('questions' in question) {
                    currentGroup = question;
                } else {
		            if (!currentGroup) {
			            continue;
		            }
                    currentGroup.questions.push(question);
                }
            }
        }

        return options.deferSave ? createdQuestionnaire : createdQuestionnaire.save();
    }

    private async createNewVersionFromUpload(
        currentVersion: Questionnaire,
        questionnaireInput: UpdateQuestionnaireInput,
        excelFile: FileUpload,
    ): Promise<Questionnaire> {
        if (currentVersion.zombie) {
            throw new BadRequestException('Cannot create a new version from an old questionnaire version');
        }

        const fileData = await this.readFileUpload(excelFile);
        const xlsFormParsed = new XLSForm(fileData);
        const settings = xlsFormParsed.getSettings();
        const language = questionnaireInput.language || currentVersion.language;

        if (settings.form_id !== currentVersion.abbreviation || language !== currentVersion.language) {
            throw new BadRequestException(
                'New questionnaire versions must keep the same language and XLS form_id.',
            );
        }

        const rootId = currentVersion.versionRootId || currentVersion._id.toString();
        const latestVersion = await this.questionnaireModel
            .findOne({ versionRootId: rootId })
            .sort({ versionNumber: -1 })
            .exec();
        const nextVersionNumber = (latestVersion?.versionNumber || currentVersion.versionNumber || 1) + 1;

        const newVersion = await this.createQuestionnaireFromFileData(
            fileData,
            {
                ...questionnaireInput,
                language,
                status: questionnaireInput.status || currentVersion.status,
            } as CreateQuestionnaireInput,
            { skipUniqueCheck: true, deferSave: true },
        );
        newVersion.versionRootId = rootId;
        newVersion.versionNumber = nextVersionNumber;
        newVersion.replacedById = null;
        newVersion.zombie = false;

        currentVersion.zombie = true;
        currentVersion.replacedById = newVersion._id.toString();
        if (!currentVersion.versionRootId) currentVersion.versionRootId = rootId;
        if (!currentVersion.versionNumber) currentVersion.versionNumber = 1;
        await currentVersion.save();

        try {
            return await newVersion.save();
        } catch (error) {
            currentVersion.zombie = false;
            currentVersion.replacedById = null;
            await currentVersion.save();
            throw error;
        }
    }

    private async ensureQuestionnaireVersionIndexes(): Promise<void> {
        if (!this.questionnaireIndexesReady) {
            this.questionnaireIndexesReady = (async () => {
                try {
                    await this.questionnaireModel.collection.dropIndex('language_1_abbreviation_1');
                } catch (error) {
                    if (error?.codeName !== 'IndexNotFound') throw error;
                }
                await this.questionnaireModel.collection.createIndex(
                    { language: 1, abbreviation: 1 },
                    {
                        unique: true,
                        partialFilterExpression: { zombie: false },
                        name: 'language_1_abbreviation_1',
                    },
                );
                await this.questionnaireModel.collection.createIndex(
                    { versionRootId: 1, versionNumber: -1 },
                    { name: 'versionRootId_1_versionNumber_-1' },
                );
            })();
        }
        return this.questionnaireIndexesReady;
    }

    private async validateDepartmentAccess(
        currentUser: User,
        departmentIds: number[],
    ): Promise<void> {
        const uniqueDepartmentIds = [...new Set(departmentIds || [])];
        if (uniqueDepartmentIds.length) {
            const departments = await Department.count({
                where: { id: In(uniqueDepartmentIds) },
            });
            if (departments !== uniqueDepartmentIds.length) {
                throw new NotFoundException('One of the departments does not exist');
            }
        }

        const canAccess = await this.userDepartmentAccessService.canAccessDepartments(
            currentUser.id,
            uniqueDepartmentIds,
        );
        if (!canAccess) {
            throw new ForbiddenException('Cannot assign questionnaire to these departments');
        }
    }

    private extractQuestionnaireInput(input: CreateQuestionnaireInput | any): CreateQuestionnaireInput {
        return input?.xlsForm || input?.input?.xlsForm || input?.input || input;
    }

    private async extractQuestionnaireUpload(input: CreateQuestionnaireInput | any): Promise<FileUpload> {
        return input?.excelFile || input?.xlsForm || input?.file || input;
    }

    private async extractOptionalQuestionnaireUpload(input: CreateQuestionnaireInput | any): Promise<FileUpload | undefined> {
        const upload = input?.excelFile || input?.file;
        if (!upload) return undefined;
        return upload;
    }

    private readFileUpload(xlsForm: FileUpload): Promise<FileData[]> {
        if (!xlsForm || typeof xlsForm.createReadStream !== 'function') {
            throw new Error('Questionnaire file is required');
        }

        return new Promise((resolve, reject) => {
            const stream = xlsForm.createReadStream();
            const chunks = [];

            stream.on('data', (chunk: Buffer) => chunks.push(chunk));
            stream.on('error', reject);
            stream.on('end', () => {
                try {
                    const fileData = xlsx.parse(Buffer.concat(chunks), {
                        type: 'buffer',
                    }) as FileData[];
                    resolve(fileData);
                } catch (error) {
                    reject(error);
                }
            });
        });
    }
}
