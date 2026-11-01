import { QuestionnaireType } from "../enums/xlsform-reader.enum";

export interface FileData {
    name: string;
    data: string[][];
}

export interface FormSettings {
    form_title: string;
    form_id: string;
    version: string;
    submission_url: string;
    questionnaire_type: QuestionnaireType;
    language: string;
}

export interface QuestionData {
    type: string;
    name: string;
    label: string;
    min_length: number;
    max_length: number;
    relevant: string;
    choice_filter: string;
    appearance: string;
    _row?: number;
    page_break_before?: boolean | string;
    range_min?: number;
    range_max?: number;
    range_step?: number | string;
    range_label_list?: string;
    range_min_label?: string;
    range_max_label?: string;
    range_labels_position?: string;
    range_value_position?: string;
    range_label_size?: number;
    range_value_size?: number;
    range_labels_boxed?: boolean | string;
    range_labels_bold?: boolean | string;
    range_gradient?: string;
    range_color_start?: string;
    range_color_end?: string;
    hint: string;
    constraint: string;
    constraint_message: string;
    default: any;
    required: boolean;
    required_message: string;
    calculation: string;
    image: string;
}

export interface ChoiceData {
    list_name: string;
    name: string;
    label: string;
    'media::image': string;
    label_position?: string;
    label_align?: string;
}