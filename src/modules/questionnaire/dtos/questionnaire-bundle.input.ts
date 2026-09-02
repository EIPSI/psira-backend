import { Field, InputType } from "@nestjs/graphql";
import { Types } from "mongoose";
import {
    QuestionnaireBundleNodeType,
    QuestionnaireBundleRandomizationMode,
} from '../models/questionnaire-bundle.schema';

@InputType()
export class QuestionnaireBundleNodeInput {
    @Field(() => String)
    id: string;

    @Field(() => QuestionnaireBundleNodeType)
    type: QuestionnaireBundleNodeType;

    @Field(() => String, { nullable: true })
    label?: string;

    @Field(() => String, { nullable: true })
    displayTitle?: string;

    @Field(() => String, { nullable: true })
    headerHtml?: string;

    @Field(() => String, { nullable: true })
    footerHtml?: string;

    @Field(() => Boolean, { nullable: true })
    showTitle?: boolean;

    @Field(() => String, { nullable: true })
    questionnaireId?: Types.ObjectId | string;

    @Field(() => QuestionnaireBundleRandomizationMode, { nullable: true })
    randomizationMode?: QuestionnaireBundleRandomizationMode;

    @Field(() => Number, { nullable: true })
    selectionCount?: number;

    @Field(() => Number, { nullable: true })
    weight?: number;

    @Field(() => [QuestionnaireBundleNodeInput], { nullable: true })
    children?: QuestionnaireBundleNodeInput[];
}

@InputType()
export class CreateQuestionnaireBundleInput {
    @Field(() => String)
    name: string;

    @Field(() => [QuestionnaireBundleNodeInput])
    structure: QuestionnaireBundleNodeInput[];

    @Field(() => String, { nullable: true })
    structureJson?: string;

    @Field(() => String, { nullable: true })
    headerHtml?: string;

    @Field(() => String, { nullable: true })
    noticeHtml?: string;

    @Field(() => [Number], { nullable: true })
    departmentIds: number[]

    @Field(() => Boolean, { nullable: true })
    active?: boolean;
}

@InputType()
export class UpdateQuestionnaireBundleInput extends CreateQuestionnaireBundleInput {
    @Field(() => String)
    _id: string;
}
