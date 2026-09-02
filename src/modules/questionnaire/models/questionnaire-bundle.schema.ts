import { FilterableField } from "@nestjs-query/query-graphql";
import { Field, Float, Int, ObjectType, registerEnumType } from "@nestjs/graphql";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export enum QuestionnaireBundleNodeType {
    QUESTIONNAIRE = 'QUESTIONNAIRE',
    SCREEN = 'SCREEN',
    FIXED_GROUP = 'FIXED_GROUP',
    RANDOM_GROUP = 'RANDOM_GROUP',
}

export enum QuestionnaireBundleRandomizationMode {
    RANDOM_ORDER = 'RANDOM_ORDER',
    REPLACEMENT = 'REPLACEMENT',
}

registerEnumType(QuestionnaireBundleNodeType, {
    name: 'QuestionnaireBundleNodeType',
});

registerEnumType(QuestionnaireBundleRandomizationMode, {
    name: 'QuestionnaireBundleRandomizationMode',
});

@ObjectType()
export class QuestionnaireBundleNode {
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

    @Field(() => Int, { nullable: true })
    selectionCount?: number;

    @Field(() => Float, { nullable: true })
    weight?: number;

    @Field(() => [QuestionnaireBundleNode], { nullable: true })
    children?: QuestionnaireBundleNode[];
}

@ObjectType()
@Schema({ collection: "questionnaire_bundle", timestamps: true })
export class QuestionnaireBundle extends Document {
    @Field(() => String)
    _id: Types.ObjectId

    @FilterableField(() => String)
    @Prop({ type: 'string' })
    name: string;

    @Field(() => [QuestionnaireBundleNode])
    @Prop({ type: [Object], default: [] })
    structure: QuestionnaireBundleNode[];

    @Field(() => String, { nullable: true })
    @Prop({ type: String, default: '[]' })
    structureJson?: string;

    @Field(() => String, { nullable: true })
    @Prop({ type: String, default: '' })
    headerHtml?: string;

    @Field(() => String, { nullable: true })
    @Prop({ type: String, default: '' })
    noticeHtml?: string;

    @Field(() => [Number], { nullable: true })
    @Prop({ type: [Number] })
    departmentIds: number[];

    @FilterableField(() => Boolean, { defaultValue: true })
    @Prop({ type: Boolean, default: true })
    active: boolean;

    @Field(() => Number)
    @Prop({ type: Number })
    author: number;

    @FilterableField(() => Date)
    @Prop()
    createdAt: Date;

    @Field(() => Date)
    @Prop()
    updatedAt: Date;

    @Field(() => Boolean, { defaultValue: false })
    @Prop()
    deleted: boolean;
}

export const QuestionnaireBundleSchema = SchemaFactory.createForClass(QuestionnaireBundle);
