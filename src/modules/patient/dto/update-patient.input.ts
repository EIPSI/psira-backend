import { Field, InputType, Int, PartialType } from '@nestjs/graphql';
import { IsOptional } from 'class-validator';
import { CreatePatientInput } from './create-patient.input';

@InputType()
export class UpdatePatientInput extends PartialType(CreatePatientInput) {
    @Field(() => [Int], { nullable: true, description: 'IDs of case managers to assign to this patient' })
    @IsOptional()
    caseManagerIds?: number[];
}
