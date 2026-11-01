import { InputType, Field, Int } from '@nestjs/graphql';
import { Max, MaxLength, Min } from 'class-validator';
import { MAX_ROLE_HIERARCHY, MIN_ROLE_HIERARCHY } from '../constants';

@InputType()
export class RoleInput {
    @MaxLength(120)
    @Field()
    name: string;

    @Field(() => [Int], { nullable: true })
    departmentIds?: number[];

    @Field()
    @Max(MIN_ROLE_HIERARCHY)
    @Min(MAX_ROLE_HIERARCHY)
    hierarchy: number;
}
