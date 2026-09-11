import { Field, InputType, Int } from "@nestjs/graphql";
import { IsEmail, IsInt, IsOptional } from "class-validator";


@InputType()
export class CaregiverInput {
    @Field()
    firstName: string;

    @Field()
    phone!: string;

    @IsOptional()
    @Field({ nullable: true })
    middleName?: string;

    @Field()
    lastName: string;

    @IsEmail()
    @Field()
    email: string;

    @IsOptional()
    @Field({ nullable: true })
    street?: string;

    @IsOptional()
    @Field({ nullable: true })
    country?: string;

    @IsOptional()
    @Field({ nullable: true })
    place?: string;

    @IsOptional()
    @Field({ nullable: true })
    number?: string;

    @IsOptional()
    @Field({ nullable: true })
    apartment?: string;

    @IsOptional()
    @Field({ nullable: true })
    postalCode?: string;

    @IsOptional()
    @Field(() => [Int], { nullable: true })
    skippedAutomationIds?: number[];

    @Field(() => Int)
    @IsInt()
    patientId: number;

    @IsOptional()
    @Field({ nullable: true })
    relation?: string;

    @IsOptional()
    @Field({ nullable: true })
    emergency?: boolean;

    @IsOptional()
    @Field({ nullable: true })
    note?: string;

    @IsOptional()
    @Field({ nullable: true })
    skipEmergencyContactCreation?: boolean;

    @IsOptional()
    @Field(() => Int, { nullable: true })
    emergencyContactId?: number;
}
