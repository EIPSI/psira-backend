import { IsOptional, IsString } from 'class-validator';
import { ArgsType, Field } from '@nestjs/graphql';

@ArgsType()
export class LoginRequestDto {

  @Field(() => String)
  @IsString()
  identifier: string;

  @Field(() => String)
  @IsString()
  password: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  detectedTimezone?: string;
}
