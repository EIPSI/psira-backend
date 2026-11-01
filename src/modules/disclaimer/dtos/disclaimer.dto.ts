import { Field, GraphQLISODateTime, InputType, Int } from '@nestjs/graphql';

@InputType()
export class UpdateDisclaimerInput {
    @Field(() => Int, { nullable: true })
    departmentId?: number;

    @Field(() => String)
    type: string;

    @Field(() => String)
    description: string;
}
