import { InputType, PartialType } from '@nestjs/graphql';
import { CreatePatientInput } from './create-patient.input';
import { Field, Int, ObjectType } from '@nestjs/graphql';
import { CreateOneInputType } from '@nestjs-query/query-graphql';

@InputType()
export class CreatePatientStatus {
    @Field(() => [Int], { nullable: true })
    departmentIds?: number[];

    @Field(() => String)
    name: string;

    @Field(() => String, { nullable: true })
    description: string;
}

@InputType()
export class CreateOnePatientStatusInput extends CreateOneInputType(
    'patientStatus',
    CreatePatientStatus,
) {}
