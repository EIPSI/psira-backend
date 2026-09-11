import { Field, InputType, Int } from '@nestjs/graphql';
import { CaseEventReasonContext } from '../enums/case-event-reason-context.enum';

@InputType()
export class CreateCaseEventReasonInput {
    @Field(() => CaseEventReasonContext)
    context: CaseEventReasonContext;

    @Field()
    label: string;

    @Field({ nullable: true })
    nextLevelLabel?: string;

    @Field(() => Int, { nullable: true })
    parentId?: number | null;

    @Field(() => Int, { nullable: true })
    departmentId?: number | null;

    @Field(() => Boolean, { nullable: true })
    active?: boolean;

    @Field(() => Boolean, { nullable: true })
    isOther?: boolean;

    @Field(() => Int, { nullable: true })
    sortOrder?: number;
}

@InputType()
export class UpdateCaseEventReasonInput {
    @Field(() => Int)
    id: number;

    @Field(() => CaseEventReasonContext, { nullable: true })
    context?: CaseEventReasonContext;

    @Field({ nullable: true })
    label?: string;

    @Field({ nullable: true })
    nextLevelLabel?: string;

    @Field(() => Int, { nullable: true })
    parentId?: number | null;

    @Field(() => Int, { nullable: true })
    departmentId?: number | null;

    @Field(() => Boolean, { nullable: true })
    active?: boolean;

    @Field(() => Boolean, { nullable: true })
    isOther?: boolean;

    @Field(() => Int, { nullable: true })
    sortOrder?: number;
}
