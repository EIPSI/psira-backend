import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class DepartmentInput {

    @Field()
    name!: string;

    @Field({ nullable: true })
    description?: string;

    @Field({ nullable: true, defaultValue: true })
    active?: boolean;

    @Field(() => [String], { nullable: true })
    appliedRoleCodes?: string[];

    @Field(() => [String], { nullable: true })
    defaultRoleCodes?: string[];

}
