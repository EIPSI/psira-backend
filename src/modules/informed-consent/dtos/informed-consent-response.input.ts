import { Field, InputType, Int } from '@nestjs/graphql';
import {
    IsArray,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InformedConsentResponseStatus } from '../enums/informed-consent-response-status.enum';

@InputType()
export class InformedConsentResponseAnswerInput {
    @Field(() => Int)
    @IsInt()
    questionId: number;

    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    answerOptionId?: number;

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    valueText?: string;

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    valueJson?: string;
}

@InputType()
export class SubmitInformedConsentResponseInput {
    @Field(() => Int)
    @IsInt()
    managementId: number;

    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    representedUserId?: number;

    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    patientId?: number;

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    language?: string;

    @Field(() => [InformedConsentResponseAnswerInput])
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => InformedConsentResponseAnswerInput)
    answers: InformedConsentResponseAnswerInput[];
}

@InputType()
export class ReviewInformedConsentResponseInput {
    @Field(() => Int)
    @IsInt()
    responseId: number;

    @Field()
    @IsString()
    reason: string;

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    comment?: string;
}

@InputType()
export class CancelInformedConsentReactivationInput {
    @Field(() => Int)
    @IsInt()
    responseId: number;

    @Field(() => InformedConsentResponseStatus)
    @IsEnum(InformedConsentResponseStatus)
    previousStatus: InformedConsentResponseStatus;
}
