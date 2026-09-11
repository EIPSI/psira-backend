import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class CreateClinicalSessionCancellationReasonInput {
    @Field()
    label: string;

    @Field(() => Int, { nullable: true })
    parentId?: number;

    @Field(() => Boolean, { nullable: true })
    active?: boolean;

    @Field(() => Int, { nullable: true })
    sortOrder?: number;
}

@InputType()
export class UpdateClinicalSessionCancellationReasonInput {
    @Field(() => Int)
    id: number;

    @Field({ nullable: true })
    label?: string;

    @Field(() => Int, { nullable: true })
    parentId?: number;

    @Field(() => Boolean, { nullable: true })
    active?: boolean;

    @Field(() => Int, { nullable: true })
    sortOrder?: number;
}
