import { Field, InputType, Int, PartialType } from '@nestjs/graphql';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { NotificationEvent } from '../enums/notification-event.enum';
import { NotificationFamily } from '../enums/notification-family.enum';

@InputType()
export class CreateNotificationConfigurationInput {
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    departmentId?: number;

    @Field(() => NotificationChannel)
    @IsEnum(NotificationChannel)
    channel: NotificationChannel;

    @Field(() => NotificationFamily)
    @IsEnum(NotificationFamily)
    family: NotificationFamily;

    @Field(() => NotificationEvent)
    @IsEnum(NotificationEvent)
    event: NotificationEvent;

    @Field(() => Int)
    @IsInt()
    recipientRoleId: number;

    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    mailTemplateId?: number;

    @Field(() => Boolean, { nullable: true })
    @IsOptional()
    @IsBoolean()
    active?: boolean;

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    notes?: string;
}

@InputType()
export class UpdateNotificationConfigurationInput extends PartialType(
    CreateNotificationConfigurationInput,
) {
    @Field(() => Int)
    @IsInt()
    id: number;
}
