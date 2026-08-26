import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { AnswerAssessmentInput } from '../dtos/assessment.input';
import { Answer } from '../models/answer.schema';
import { QuestionnaireAssessment } from '../models/questionnaire-assessment.schema';
import { Questionnaire, QuestionnaireStatus } from '../models/questionnaire.schema';
import { QuestionValidatorFactory } from '../helpers/question-validator.factory';
import { AssessmentStatus } from '../enums/assessment-status.enum';
import { UserInputError } from 'apollo-server-express';
import { BadRequestException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Assessment } from 'src/modules/assessment/models/assessment.model';
import { Repository } from 'typeorm';
import { QuestionnaireBundle } from '../models/questionnaire-bundle.schema';
import { QuestionnaireBundleResolutionService } from './questionnaire-bundle-resolution.service';
import { RandomizationResolutionService } from 'src/modules/randomization/services/randomization-resolution.service';
import { NotificationDispatchService } from 'src/modules/notification/services/notification-dispatch.service';
import { NotificationEvent } from 'src/modules/notification/enums/notification-event.enum';

export class QuestionnaireAssessmentService {
    constructor(
        @InjectModel(QuestionnaireAssessment.name)
        private assessmentModel: Model<QuestionnaireAssessment>,
        @InjectModel(Answer.name)
        private answerModel: Model<Answer>,
        @InjectModel(Questionnaire.name)
        private questionnaireModel: Model<Questionnaire>,
        @InjectRepository(Assessment)
        private assessmentRepository: Repository<Assessment>,
        private questionnaireBundleResolutionService: QuestionnaireBundleResolutionService,
        @Optional()
        private notificationDispatchService: NotificationDispatchService,
        @Optional()
        private randomizationResolutionService?: RandomizationResolutionService,
    ) {}

    async createNewAssessment(
        questionnaires: Types.ObjectId[],
        questionnaireBundles?: Types.ObjectId[],
        randomizationRuleIds?: number[],
    ) {
        const resolvedSequence = await this.resolveQuestionnaires(
            questionnaires || [],
            questionnaireBundles || [],
            randomizationRuleIds || [],
        );

        return this.assessmentModel.create({
            questionnaires: resolvedSequence.questionnaireIds,
            questionnaireBundles: resolvedSequence.questionnaireBundleIds,
            randomizationRuleIds: randomizationRuleIds || [],
            resolvedQuestionnaires: resolvedSequence.resolvedQuestionnaires,
        });
    }

    /**
     * Adds an answer subdocument to existing mongodb questionnaire assessment
     * @param assessmentAnswerInput
     * @returns
     */
    async addAnswerToAssessment(assessmentAnswerInput: AnswerAssessmentInput) {
        const foundAssessment: QuestionnaireAssessment = await this.assessmentModel.findById(
            assessmentAnswerInput.assessmentId,
        );

        // TODO: check if this version is newest version. if not throw error

        if (!foundAssessment) {
            throw new Error('No assessment found.');
        }

        if (
            ![
                AssessmentStatus.PARTIALLY_COMPLETED,
                AssessmentStatus.OPEN_FOR_COMPLETION,
            ].includes(foundAssessment.status)
        ) {
            throw new Error(
                'You cannot add any more answers to this assessment.',
            );
        }

        const questionnaire: Questionnaire = await this.questionnaireModel.findById(
            assessmentAnswerInput.questionnaireVersionId,
        );

        if (
            !questionnaire ||
            !(foundAssessment.questionnaires as Types.ObjectId[]).some(
                questionnaireId => questionnaireId.toString() === questionnaire._id.toString(),
            ) ||
            ![
                QuestionnaireStatus.PUBLISHED,
                QuestionnaireStatus.PRIVATE,
            ].includes(questionnaire.status)
        ) {
            throw new Error('Invalid questionnaire linked to this question.');
        }
        const question = questionnaire.questionGroups
            .filter(
                questionGroups =>
                    questionGroups.questions.filter(
                        item => item._id == assessmentAnswerInput.question,
                    ).length > 0,
            )[0]
            ?.questions.filter(
                item => item._id == assessmentAnswerInput.question,
            )[0];

        if (!question) {
            throw new Error('Invalid question answered');
        }

        const answerExisting = foundAssessment.answers.find(
            item =>
                item.question?.toString() === assessmentAnswerInput.question?.toString() &&
                (item.occurrenceId || null) === (assessmentAnswerInput.occurrenceId || null),
        );

        const answer = answerExisting ?? new this.answerModel();

        answer.question = assessmentAnswerInput.question;
        answer.occurrenceId = assessmentAnswerInput.occurrenceId;
        answer.multipleChoiceValue = assessmentAnswerInput.multipleChoiceValue;
        answer.booleanValue = assessmentAnswerInput.booleanValue;
        answer.textValue = assessmentAnswerInput.textValue;
        answer.numberValue = assessmentAnswerInput.numberValue;
        answer.dateValue = assessmentAnswerInput.dateValue;

        const validator = QuestionValidatorFactory.getValidatorForQuestion(
            question,
        );

        try {
            answer.valid = validator.isValid(answer);

            if (!answerExisting) {
                foundAssessment.answers.push(answer);
            } else {
                foundAssessment.answers[
                    foundAssessment.answers.indexOf(answerExisting)
                ] = answer;
            }

            // return updated model
            return foundAssessment.save();
        } catch (e) {
            if (e instanceof UserInputError) {
                answer.valid = false;
                if (answerExisting) {
                    // invalidate existing answer
                    foundAssessment.answers[
                        foundAssessment.answers.indexOf(answerExisting)
                    ] = answer;
                    await foundAssessment.save();
                }
            }
            throw e;
        }
    }

    async changeAssessmentStatus(
        assessmentId: Types.ObjectId,
        status: AssessmentStatus,
    ) {
        const assessmentModel = await this.assessmentModel.findById(
            assessmentId,
        );
        const assessment = await this.assessmentRepository.findOne({
            where: { questionnaireAssessmentId: assessmentId },
        });

        const completedNow =
            assessmentModel.status !== AssessmentStatus.COMPLETED &&
            status === AssessmentStatus.COMPLETED;

        if (completedNow && assessment) {
            assessment.submissionDate = new Date();
        }

        if (assessment) {
            assessment.status = status;
            await assessment.save();
        }

        assessmentModel.status = status;
        const savedAssessmentModel = await assessmentModel.save();

        if (completedNow && assessment && this.notificationDispatchService) {
            await this.notificationDispatchService.dispatchAssessmentEvent(
                NotificationEvent.ASSESSMENT_ANSWERED,
                assessment.id,
            );
        }

        return savedAssessmentModel;
    }

    async deleteAssessment(_id: Types.ObjectId, archive = true) {
        const assessment = await this.assessmentModel.findById(_id);

        return (archive
            ? this.assessmentModel.findByIdAndUpdate(_id, {
                  status:
                      assessment?.status !== AssessmentStatus.COMPLETED
                          ? AssessmentStatus.CANCELLED
                          : assessment?.status,
              })
            : this.assessmentModel.findByIdAndDelete(_id)
        )
            .orFail()
            .exec();
    }

    getById(_id: Types.ObjectId | string, populate = true) {
        if (typeof _id === 'string') {
            _id = Types.ObjectId(_id);
        }

        const query = this.assessmentModel.findById(_id)

        if (populate) {
            query.populate({
                path: 'questionnaires',
                model: Questionnaire.name,
            });
            query.populate({
                path: 'questionnaireBundles',
                model: QuestionnaireBundle.name,
            });
        }
        
        return query.orFail().exec();
    }

    async updateAssessment(
        assessmentId: Types.ObjectId | QuestionnaireAssessment,
        questionnaires: Types.ObjectId[],
        questionnaireBundles?: Types.ObjectId[],
        randomizationRuleIds?: number[],
    ) {
        let questionnaireAssessment: QuestionnaireAssessment;

        if (isValidObjectId(assessmentId)) {
            questionnaireAssessment = await this.assessmentModel
                .findById(assessmentId)
                .orFail()
                .exec();
        } else {
            questionnaireAssessment = assessmentId as QuestionnaireAssessment;
        }

        const resolvedSequence = await this.resolveQuestionnaires(
            questionnaires || [],
            questionnaireBundles || [],
            randomizationRuleIds || [],
        );

        questionnaireAssessment.questionnaires = resolvedSequence.questionnaireIds;
        questionnaireAssessment.questionnaireBundles = resolvedSequence.questionnaireBundleIds;
        questionnaireAssessment.randomizationRuleIds = randomizationRuleIds || [];
        questionnaireAssessment.resolvedQuestionnaires = resolvedSequence.resolvedQuestionnaires;
        return questionnaireAssessment.save();
    }

    private async resolveQuestionnaires(
        questionnaires: Types.ObjectId[],
        questionnaireBundles: Types.ObjectId[],
        randomizationRuleIds: number[],
    ) {
        const baseSequence = await this.questionnaireBundleResolutionService.resolveQuestionnaireSequence(
            questionnaires || [],
            questionnaireBundles || [],
        );

        if (!randomizationRuleIds?.length) {
            return {
                questionnaireIds: baseSequence.questionnaireIds,
                questionnaireBundleIds: questionnaireBundles || [],
                resolvedQuestionnaires: baseSequence.resolvedQuestionnaires,
            };
        }

        if (!this.randomizationResolutionService) {
            throw new BadRequestException('Randomization resolution is not available');
        }

        const randomizationSequence = await this.randomizationResolutionService.resolveLowLevelRules(
            randomizationRuleIds,
        );
        const resolvedQuestionnaires = [...baseSequence.resolvedQuestionnaires];

        resolvedQuestionnaires.push(
            ...randomizationSequence.resolvedQuestionnaires.map(questionnaire => ({
                ...questionnaire,
                orderIndex: resolvedQuestionnaires.length + questionnaire.orderIndex,
            })),
        );

        return {
            questionnaireIds: [
                ...baseSequence.questionnaireIds,
                ...randomizationSequence.questionnaireIds,
            ],
            questionnaireBundleIds: [
                ...(questionnaireBundles || []),
                ...randomizationSequence.questionnaireBundleIds,
            ],
            resolvedQuestionnaires,
        };
    }
}
