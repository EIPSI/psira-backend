import { readPresentation } from './question-presentation.helper';
import { QuestionGroup } from '../models/question-group.schema';
import { Choice, Question, QuestionType } from '../models/question.schema';
import { XLSForm } from './xlsform-reader.helper';
import { QuestionData } from '../dtos/xlsform.dto';

export class XlsFormQuestionFactory {
    public static createQuestion(
        questionRow: Partial<QuestionData>,
        xlsForm: XLSForm,
        question: Question,
        questionGroup: QuestionGroup,
    ): Question | QuestionGroup {
        if (questionRow.type === QuestionType.BEGIN_GROUP) {
            if (['likert-matrix', 'table-list'].includes(questionRow.appearance?.toLowerCase())) {
                questionGroup.appearance = questionRow.appearance.toLowerCase();
            }
            if (questionRow.page_break_before != null && questionRow.page_break_before !== '') {
                const value = String(questionRow.page_break_before).trim().toLowerCase();
                if (!['true', 'false', 'yes', 'no', '1', '0'].includes(value)) {
                    throw new Error(`survey row ${questionRow._row}: page_break_before must be true or false`);
                }
                questionGroup.pageBreakBefore = ['true', 'yes', '1'].includes(value);
            }
            questionGroup.label = questionRow.label;
            questionGroup.appearance = questionRow.appearance;
            return questionGroup;
        } else {
            if (questionRow.page_break_before != null && questionRow.page_break_before !== '' &&
                !['false', 'no', '0'].includes(String(questionRow.page_break_before).trim().toLowerCase())) {
                throw new Error(`survey row ${questionRow._row}: page_break_before is only supported on begin_group`);
            }
            const presentation = readPresentation(questionRow, questionRow.range_label_list ? xlsForm.getChoiceData() : []);
            question = {
                ...question,
                ...questionRow,
                presentation,
                appearance: questionRow.appearance?.toString().trim().toLowerCase(),
                constraintMessage: questionRow.constraint_message,
                requiredMessage: questionRow.required_message,
                max: questionRow.max_length,
                min: questionRow.min_length,
            } as Question;
            // TODO: maybe make invalid column check here...

            if (
                questionRow.type?.startsWith(QuestionType.SELECT_ONE) ||
                questionRow.type?.startsWith(QuestionType.SELECT_MULTIPLE)
            ) {
                const questionType = questionRow.type?.split(' ');
                const listName = questionType[1];
                question.type = questionType[0];
                const choices: Choice[] = xlsForm
                    .getChoiceData()
                    .filter(item => item.list_name === listName)
                    .map(
                        choice =>
                            ({
                                label: choice.label,
                                name: choice.name,
                                image: choice['media::image'],
                            } as Choice),
                    );

                question.choices = choices;
            }

            if (question.type === QuestionType.TEXT && question.max !== undefined &&
                (!Number.isInteger(Number(question.max)) || Number(question.max) <= 0)) {
                throw new Error(`survey row ${questionRow._row}: max_length must be a positive integer`);
            }
            return question;
        }
    }
}
