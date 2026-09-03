import { InputType, Field, Int } from '@nestjs/graphql';
import { IsDate, IsEmail, IsLowercase, MaxDate, MinDate } from 'class-validator';
import * as moment from 'moment';
import { GenderEnum } from 'src/modules/patient/models/gender.enum';
import { IsOptional, IsPhoneNumber } from 'src/shared';

@InputType()
export class CreateUserInput {

  @IsLowercase()
  @Field({ nullable: true })
  username?: string;

  @Field()
  password: string;

  @Field({ nullable: true, defaultValue: true })
  active: boolean;

  @Field()
  firstName: string;

  @Field({ nullable: true })
  middleName?: string;

  @Field()
  lastName: string;

  @IsEmail()
  @Field()
  email: string;

  @IsOptional()
  @IsPhoneNumber()
  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  workID?: string;

  @Field({ nullable: true })
  address?: string;

  @Field({ nullable: true })
  gender?: GenderEnum;

  @IsOptional()
  @IsDate()
  @MinDate(moment('1900-01-01').toDate())
  @MaxDate(moment().toDate())
  @Field({ nullable: true })
  birthDate?: Date;

  @Field({ nullable: true })
  nationality?: string;

  @Field(() => [Int], { nullable: true })
  departmentIds?: number[];

  @Field(() => [String], { nullable: true })
  roleCodes?: string[];

  @Field(() => [Int], { nullable: true })
  skippedAutomationIds?: number[];

  skipCaregiverProfileSync?: boolean;
}
