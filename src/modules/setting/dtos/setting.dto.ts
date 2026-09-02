import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsLocale, Max, Min } from 'class-validator';
import { IsOptional } from 'src/shared';

@InputType('SettingInput')
@ObjectType()
export class SettingDto {
    @IsOptional()
    @IsLocale()
    @Field({ nullable: true })
    systemLocale?: string;

    @IsOptional()
    @Field({ nullable: true })
    systemTimezone?: string;

    @IsOptional()
    @Field({ nullable: true })
    dateFormat?: string;

    @IsOptional()
    @Field({ nullable: true })
    timeFormat?: string;

    @IsOptional()
    @Field({ nullable: true })
    dateTimeFormat?: string;

    @IsOptional()
    @Field({ nullable: true, defaultValue: 5 })
    @Min(1)
    maxLoginAttempts?: number;

    @IsOptional()
    @Max(365)
    @Min(15)
    @Field(() => Int, { nullable: true })
    passwordLifeTimeInDays?: number;

    @IsOptional()
    @Max(365 * 5)
    @Min(0)
    @Field(() => Int, { nullable: true })
    passwordReUseCutoffInDays?: number;

    @IsOptional()
    @Max(365 * 10)
    @Min(1)
    @Field(() => Int, { nullable: true })
    evaluationAutomationRunRetentionDays?: number;

    @IsOptional()
    @Max(365 * 5)
    @Min(1)
    @Field(() => Int, { nullable: true })
    treatmentFinalizationUndoWindowDays?: number;

    @IsOptional()
    @Min(0)
    @Field(() => Int, { nullable: true })
    patientCaseManagerAssignableHierarchyRank?: number;

    @IsOptional()
    @Field({ nullable: true, defaultValue: false })
    googleCalendarEnabled?: boolean;

    @IsOptional()
    @Field({ nullable: true, defaultValue: true })
    notificationsEnabled?: boolean;

    @IsOptional()
    @Field({ nullable: true, defaultValue: true })
    informedConsentEnabled?: boolean;

    @IsOptional()
    @Field({ nullable: true })
    googleCalendarClientId?: string;

    @IsOptional()
    @Field({ nullable: true })
    googleCalendarClientSecret?: string;

    @IsOptional()
    @Field({ nullable: true })
    googleCalendarRedirectUri?: string;
}
