import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';

@InputType()
export class UserPreferencesInput {
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    timezone?: string;

    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    detectedTimezone?: string;
}
