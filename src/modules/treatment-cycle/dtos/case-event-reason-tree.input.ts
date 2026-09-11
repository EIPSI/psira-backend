import { Field, InputType, Int } from '@nestjs/graphql';
import { CaseEventReasonContext } from '../enums/case-event-reason-context.enum';

@InputType()
export class CreateCaseEventReasonTreeInput {
    @Field(() => CaseEventReasonContext)
    context: CaseEventReasonContext;

    @Field(() => Int, { nullable: true })
    departmentId?: number | null;

    @Field(() => [String], { nullable: true })
    levelLabels?: string[];
}

@InputType()
export class UpdateCaseEventReasonTreeInput {
    @Field(() => Int)
    id: number;

    @Field(() => CaseEventReasonContext)
    context: CaseEventReasonContext;

    @Field(() => Int, { nullable: true })
    departmentId?: number | null;

    @Field(() => [String], { nullable: true })
    levelLabels?: string[];
}
