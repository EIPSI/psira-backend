import { ChoiceData, QuestionData } from '../dtos/xlsform.dto';
import { QuestionPresentation } from '../models/question.schema';

export function readPresentation(row: Partial<QuestionData>, choices: Partial<ChoiceData>[]): QuestionPresentation | undefined {
    const appearance = row.appearance?.toString().trim().toLowerCase();
    const type = row.type?.split(' ')[0];
    const fail = (message: string): never => { throw new Error(`survey row ${row._row || '?'} (${row.name}): ${message}`); };
    if (['likert', 'cards'].includes(appearance) && !['select_one', 'select_multiple'].includes(type)) fail(`${appearance} requires a choice question`);
    if (appearance === 'likert' && type !== 'select_one') fail('likert requires select_one');
    if (!['slider', 'vas'].includes(appearance)) return undefined;
    if (!['integer', 'decimal'].includes(type)) fail(`${appearance} requires integer or decimal`);
    if (appearance === 'vas' && type !== 'decimal') fail('continuous VAS requires decimal; use slider for integer values');
    const number = (value: any, fallback: number, name: string): number => {
        if (value === undefined || value === '') return fallback;
        const result = Number(value);
        if (!Number.isFinite(result)) fail(`${name} must be numeric`);
        return result;
    };
    const option = (value: any, fallback: string, allowed: string[], name: string): string => {
        const result = value === undefined || value === '' ? fallback : String(value).trim().toLowerCase();
        if (!allowed.includes(result)) fail(`${name}: use ${allowed.join(', ')}`);
        return result;
    };
    const bool = (value: any, name: string) => option(value, 'false', ['true', 'false', 'yes', 'no', '1', '0'], name)
        .match(/^(true|yes|1)$/) !== null;
    const min = number(row.range_min, 0, 'range_min');
    const max = number(row.range_max, 100, 'range_max');
    if (max <= min) fail('range_max must be greater than range_min');
    const step = row.range_step === 'any' || ((row.range_step === undefined || row.range_step === '') && appearance === 'vas')
        ? undefined : number(row.range_step, type === 'integer' ? 1 : 0.1, 'range_step');
    if (step !== undefined && (step <= 0 || step > max - min)) fail('range_step must be positive and no larger than the range');
    if (step && Math.abs((max - min) / step - Math.round((max - min) / step)) > 0.000001) fail('range_step must divide the range into equal steps');
    if (type === 'integer' && (!Number.isInteger(min) || !Number.isInteger(max) || !Number.isInteger(step))) fail('integer sliders require integer bounds and step');
    const position = option(row.range_labels_position, 'above', ['above', 'below'], 'range_labels_position');
    const list = row.range_label_list ? choices.filter(choice => choice.list_name === row.range_label_list) : [];
    if (row.range_label_list && !list.length) fail(`range_label_list '${row.range_label_list}' not found in choices`);
    const labels = list.length ? list.map(choice => ({ value: number(choice.name, NaN, 'choices.name'), label: String(choice.label),
        position: option(choice.label_position, position, ['above', 'below'], 'choices.label_position'),
        align: option(choice.label_align, 'auto', ['auto', 'left', 'center', 'right'], 'choices.label_align'),
    })) : [{ value: min, label: String(row.range_min_label ?? min), position, align: 'auto' },
        { value: max, label: String(row.range_max_label ?? max), position, align: 'auto' }];
    if (labels.some(label => !Number.isFinite(label.value) || label.value < min || label.value > max)) fail('scale label values must be within the range');
    if (new Set(labels.map(label => label.value)).size !== labels.length) fail('scale label values must be unique');
    const size = (value: any, fallback: number, name: string) => {
        const result = number(value, fallback, name);
        if (result < 10 || result > 28) fail(`${name} must be between 10 and 28 pixels`);
        return result;
    };
    const color = (value: string, fallback: string) => {
        if (!value) return fallback;
        if (!/^#[0-9a-f]{6}$/i.test(value)) fail('range colors must use #RRGGBB');
        return value;
    };
    return { min, max, step, labels: labels.sort((a, b) => a.value - b.value),
        valuePosition: option(row.range_value_position, 'above', ['above', 'below', 'hidden'], 'range_value_position'),
        labelFontSize: size(row.range_label_size, 14, 'range_label_size'), valueFontSize: size(row.range_value_size, 18, 'range_value_size'),
        labelBoxes: bool(row.range_labels_boxed, 'range_labels_boxed'), boldLabels: bool(row.range_labels_bold, 'range_labels_bold'),
        gradient: option(row.range_gradient, 'none', ['none', 'ascending', 'descending', 'custom'], 'range_gradient'),
        colorStart: color(row.range_color_start, '#800000'), colorEnd: color(row.range_color_end, '#008080') };
}
