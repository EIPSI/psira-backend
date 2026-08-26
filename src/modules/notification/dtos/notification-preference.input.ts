import { Field, InputType, Int } from '@nestjs/graphql';
import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { NotificationEvent } from '../enums/notification-event.enum';
import { NotificationPeriodicUnit } from '../enums/notification-periodic-unit.enum';

@InputType()
export class NotificationPreferenceQueryInput {
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    patientId?: number;

    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    therapistId?: number;

    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    userId?: number;
}

@InputType()
export class UpdateNotificationPreferenceInput extends NotificationPreferenceQueryInput {
    @Field(() => Boolean, { nullable: true })
    @IsOptional()
    @IsBoolean()
    enabled?: boolean;

    @Field(() => Boolean, { nullable: true })
    @IsOptional()
    @IsBoolean()
    immediateEnabled?: boolean;

    @Field(() => Boolean, { nullable: true })
    @IsOptional()
    @IsBoolean()
    periodicEnabled?: boolean;

    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    periodicEvery?: number;

    @Field(() => NotificationPeriodicUnit, { nullable: true })
    @IsOptional()
    @IsEnum(NotificationPeriodicUnit)
    periodicUnit?: NotificationPeriodicUnit;

    @Field(() => [NotificationEvent], { nullable: true })
    @IsOptional()
    @IsEnum(NotificationEvent, { each: true })
    enabledEvents?: NotificationEvent[];

    @Field(() => [Int], { nullable: true })
    @IsOptional()
    @IsInt({ each: true })
    excludedRecipientIds?: number[];
}
