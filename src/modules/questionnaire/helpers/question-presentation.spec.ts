import { readPresentation } from './question-presentation.helper';
import { XLSForm } from './xlsform-reader.helper';
import { XlsFormQuestionFactory } from './xlsform-questions.factory';
import { Question, QuestionSchema } from '../models/question.schema';
import { QuestionGroup, QuestionGroupSchema } from '../models/question-group.schema';
import { NumberQuestionValidator } from '../validation/number.validation';
import { model } from 'mongoose';
import * as xlsx from 'node-xlsx';

const choices = [{ 'list_name': 'anchors', name: '0', label: 'Nothing', 'label_position': 'below' },
    { 'list_name': 'anchors', name: '50', label: 'Moderate', 'label_position': 'above', 'label_align': 'center' },
    { 'list_name': 'anchors', name: '100', label: 'Maximum', 'label_position': 'below' }];
const row = { _row: 3, type: 'decimal', appearance: 'vas', name: 'pain' };

describe('Spreadsheet assessment presentation', () => {
    it('defaults VAS labels above the scale without boxes and imports group page breaks without splitting matrices', () => {
        const config = readPresentation(row, []);
        expect(config.labels.every(label => label.position === 'above')).toBe(true);
        expect(config.labelBoxes).toBe(false);
        const form = new XLSForm([]);
        for (const value of [true, 'true', 'yes', '1']) {
            const group = XlsFormQuestionFactory.createQuestion({ type: 'begin_group', name: 'matrix',
                label: 'Matrix', appearance: 'likert-matrix', page_break_before: value }, form, {} as Question, {} as QuestionGroup);
            expect((group as QuestionGroup).pageBreakBefore).toBe(true);
            expect((group as QuestionGroup).appearance).toBe('likert-matrix');
        }
        expect(() => XlsFormQuestionFactory.createQuestion({ type: 'text', name: 'question',
            page_break_before: true }, form, {} as Question, {} as QuestionGroup)).toThrow('begin_group');
        expect(() => XlsFormQuestionFactory.createQuestion({ type: 'begin_group', name: 'group',
            page_break_before: 'invalid' }, form, {} as Question, {} as QuestionGroup)).toThrow('true or false');
    });
    it('keeps legacy questions on their original presentation', () => {
        expect(readPresentation({ name: 'legacy', type: 'select_one list' }, [])).toBeUndefined();
    });
    it('imports a continuous VAS without a preselected answer or forced steps', () => {
        const config = readPresentation(row, []);
        expect(config).toMatchObject({ min: 0, max: 100, valuePosition: 'above' });
        expect(config.step).toBeUndefined();
        expect((config as any).default).toBeUndefined();
    });
    it('preserves intermediate labels, their individual placement, and visual preferences', () => {
        const config = readPresentation({ ...row, 'range_label_list': 'anchors', 'range_value_position': 'hidden',
            'range_labels_boxed': 'yes', 'range_labels_bold': 'true', 'range_gradient': 'custom',
            'range_color_start': '#123456', 'range_color_end': '#abcdef' }, choices);
        expect(config.labels[1]).toMatchObject({ value: 50, position: 'above', align: 'center', label: 'Moderate' });
        expect(config).toMatchObject({ labelBoxes: true, boldLabels: true, valuePosition: 'hidden', colorStart: '#123456' });
    });
    it.each([
        { type: 'text' }, { 'range_min': 100, 'range_max': 0 }, { 'range_step': -1 }, { 'range_label_size': 50 },
        { 'range_color_start': 'url(unsafe)' }, { 'range_label_list': 'missing' }, { 'range_value_position': 'sideways' },
        { type: 'integer' }, { 'range_step': 3 },
    ])('rejects incompatible scale configuration with its source row: %j', invalid => {
        expect(() => readPresentation({ ...row, ...invalid }, choices)).toThrow(/survey row 3 \(pain\)/);
    });
    it('rejects Likert on numeric questions and cards on text', () => {
        expect(() => readPresentation({ ...row, appearance: 'likert' }, [])).toThrow('choice');
        expect(() => readPresentation({ ...row, type: 'text', appearance: 'cards' }, [])).toThrow('choice');
    });
    it('validates numeric scale bounds and steps on the server, including zero', () => {
        const presentation = readPresentation(row, []);
        const question = { type: 'decimal', name: 'pain', required: true, presentation } as Question;
        const validator = new NumberQuestionValidator(question);
        expect(validator.isValid({ numberValue: 0 } as any)).toBe(true);
        expect(validator.isValid({ numberValue: 37.125 } as any)).toBe(true);
        for (const numberValue of [-1, 101, NaN, Infinity]) expect(() => validator.isValid({ numberValue } as any)).toThrow();
        expect(() => validator.isValid({} as any)).toThrow();
        expect(() => validator.isValid({ textValue: 'not a number' } as any)).toThrow();
        question.presentation = readPresentation({ ...row, appearance: 'slider', 'range_max': 1, 'range_step': 0.1 }, []);
        expect(validator.isValid({ numberValue: 0.3 } as any)).toBe(true);
        expect(() => validator.isValid({ numberValue: 0.35 } as any)).toThrow('step');
    });
    it('keeps legacy choice codes and permits documented text max_length', () => {
        const form = new XLSForm([{ name: 'choices', data: [['list_name', 'name', 'label'], ['list', 'unchanged_code', 'Label']] }] as any);
        const question = XlsFormQuestionFactory.createQuestion({ type: 'select_one list', name: 'legacy', label: 'Legacy' },
            form, {} as Question, {} as QuestionGroup) as Question;
        expect(question.choices[0].name).toBe('unchanged_code');
        const text = XlsFormQuestionFactory.createQuestion({ type: 'text', name: 'text', label: 'Text', 'max_length': 250 },
            form, {} as Question, {} as QuestionGroup) as Question;
        expect(text.max).toBe(250);
    });
});

const workbookPaths: string[] = process.env.PSIRA_WORKBOOK_PATHS
    ? JSON.parse(process.env.PSIRA_WORKBOOK_PATHS)
    : [process.env.PSIRA_WORKBOOK_PATH].filter(Boolean);

if (workbookPaths.length) it.each(workbookPaths)('imports every example in %s through the real Mongo schemas', workbookPath => {
    const data = xlsx.parse(workbookPath);
    const suffix = workbookPaths.indexOf(workbookPath);
    const form = new XLSForm(data as any);
    const QuestionModel = model(`PresentationGuideQuestion${suffix}`, QuestionSchema);
    const GroupModel = model(`PresentationGuideGroup${suffix}`, QuestionGroupSchema);
    const groups: any[] = [];
    let group: any;
    for (const item of form.getQuestionData()) {
        if (item.type === 'end_group') { groups.push(group); group = null; continue; }
        const value = XlsFormQuestionFactory.createQuestion(item, form, new QuestionModel(), new GroupModel());
        if (item.type === 'begin_group') group = value;
        else { expect(group).toBeDefined(); group.questions.push(value); }
    }
    expect(group).toBeNull();
    expect(groups.length).toBe(5);
    const questions = groups.flatMap(item => item.questions);
    const vas = questions.find(item => item.name === 'vas_completa');
    expect(vas.presentation.labels.length).toBe(5);
    expect(vas.presentation.labels[1].position).toBe('above');
    expect(vas.presentation.valuePosition).toBe('below');
    expect(questions.find(item => item.name === 'vas_continua').presentation.step).toBeUndefined();
    expect(groups.map(item => !!item.pageBreakBefore)).toEqual([false, true, false, false, true]);
    expect(questions.find(item => item.name === 'comentario').max).toBe(250);
    expect(questions.find(item => item.name === 'satisfaccion_likert').choices[0].name).toBe('1');
    for (const item of groups) expect(item.validateSync()).toBeUndefined();
});
