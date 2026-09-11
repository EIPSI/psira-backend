import { Field, InputType, Int, PartialType } from '@nestjs/graphql';
import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InformedConsentAnswerResolution } from '../enums/informed-consent-answer-resolution.enum';
import { InformedConsentKind } from '../enums/informed-consent-kind.enum';
import { InformedConsentQuestionType } from '../enums/informed-consent-question-type.enum';

@InputType()
export class InformedConsentTextBlockInput {
    @Field(() => Int)
    @IsInt()
    orderIndex: number;

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    title?: string;

    @Field()
    @IsString()
    content: string;
}

@InputType()
export class InformedConsentAnswerOptionInput {
    @Field(() => Int)
    @IsInt()
    orderIndex: number;

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    value?: string;

    @Field()
    @IsString()
    label: string;

    @Field(() => InformedConsentAnswerResolution)
    @IsEnum(InformedConsentAnswerResolution)
    resolution: InformedConsentAnswerResolution;

    @Field({ nullable: true, defaultValue: false })
    @IsOptional()
    @IsBoolean()
    blocksUsageOnSelection?: boolean;
}

@InputType()
export class InformedConsentQuestionInput {
    @Field(() => InformedConsentKind, { nullable: true })
    @IsOptional()
    @IsEnum(InformedConsentKind)
    kind?: InformedConsentKind;

    @Field(() => [InformedConsentKind], { nullable: true })
    @IsOptional()
    @IsArray()
    @IsEnum(InformedConsentKind, { each: true })
    kinds?: InformedConsentKind[];

    @Field(() => InformedConsentQuestionType)
    @IsEnum(InformedConsentQuestionType)
    questionType: InformedConsentQuestionType;

    @Field(() => Int)
    @IsInt()
    orderIndex: number;

    @Field()
    @IsString()
    label: string;

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    helpText?: string;

    @Field({ nullable: true, defaultValue: true })
    @IsOptional()
    @IsBoolean()
    required?: boolean;

    @Field(() => [InformedConsentAnswerOptionInput], { nullable: true })
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => InformedConsentAnswerOptionInput)
    answerOptions?: InformedConsentAnswerOptionInput[];
}

@InputType()
export class CreateInformedConsentModelInput {
    @Field()
    @IsString()
    name: string;

    @Field(() => InformedConsentKind)
    @IsEnum(InformedConsentKind)
    kind: InformedConsentKind;

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    description?: string;

    @Field({ nullable: true, defaultValue: true })
    @IsOptional()
    @IsBoolean()
    active?: boolean;

    @Field({ nullable: true, defaultValue: false })
    @IsOptional()
    @IsBoolean()
    systemDefault?: boolean;

    @Field(() => [Int], { nullable: true })
    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    departmentIds?: number[];

    @Field()
    @IsString()
    versionTitle: string;

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    versionNotes?: string;

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    submitButtonLabel?: string;

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    thankYouHtml?: string;

    @Field(() => [InformedConsentTextBlockInput])
    @ValidateNested({ each: true })
    @Type(() => InformedConsentTextBlockInput)
    textBlocks: InformedConsentTextBlockInput[];

    @Field(() => [InformedConsentQuestionInput], { nullable: true })
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => InformedConsentQuestionInput)
    questions?: InformedConsentQuestionInput[];
}

@InputType()
export class UpdateInformedConsentModelInput extends PartialType(
    CreateInformedConsentModelInput,
) {
    @Field(() => Int)
    @IsInt()
    id: number;
}

@InputType()
export class CreateInformedConsentVersionInput {
    @Field(() => Int)
    @IsInt()
    modelId: number;

    @Field()
    @IsString()
    title: string;

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    notes?: string;

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    submitButtonLabel?: string;

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    thankYouHtml?: string;

    @Field(() => [InformedConsentTextBlockInput])
    @ValidateNested({ each: true })
    @Type(() => InformedConsentTextBlockInput)
    textBlocks: InformedConsentTextBlockInput[];

    @Field(() => [InformedConsentQuestionInput], { nullable: true })
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => InformedConsentQuestionInput)
    questions?: InformedConsentQuestionInput[];
}
