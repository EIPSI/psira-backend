import { Field, InputType, Int, PartialType } from '@nestjs/graphql';
import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    Min,
} from 'class-validator';
import { InformedConsentManagementStatus } from '../enums/informed-consent-management-status.enum';
import { InformedConsentTrigger } from '../enums/informed-consent-trigger.enum';

@InputType()
export class CreateInformedConsentManagementInput {
    @Field()
    @IsString()
    title: string;

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    description?: string;

    @Field(() => Int)
    @IsInt()
    modelId: number;

    @Field(() => InformedConsentManagementStatus, { nullable: true })
    @IsOptional()
    @IsEnum(InformedConsentManagementStatus)
    status?: InformedConsentManagementStatus;

    @Field(() => InformedConsentTrigger)
    @IsEnum(InformedConsentTrigger)
    trigger: InformedConsentTrigger;

    @Field({ nullable: true, defaultValue: true })
    @IsOptional()
    @IsBoolean()
    mandatory?: boolean;

    @Field({ nullable: true, defaultValue: true })
    @IsOptional()
    @IsBoolean()
    appliesToAllDepartments?: boolean;

    @Field(() => [Int], { nullable: true })
    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    departmentIds?: number[];

    @Field({ nullable: true, defaultValue: true })
    @IsOptional()
    @IsBoolean()
    appliesToAllRoles?: boolean;

    @Field(() => [Int], { nullable: true })
    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    roleIds?: number[];

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    profileConditionsJson?: string;

    @Field(() => Int, { nullable: true, defaultValue: 100 })
    @IsOptional()
    @IsInt()
    @Min(1)
    priority?: number;

    @Field({ nullable: true, defaultValue: true })
    @IsOptional()
    @IsBoolean()
    active?: boolean;
}

@InputType()
export class UpdateInformedConsentManagementInput extends PartialType(
    CreateInformedConsentManagementInput,
) {
    @Field(() => Int)
    @IsInt()
    id: number;
}
