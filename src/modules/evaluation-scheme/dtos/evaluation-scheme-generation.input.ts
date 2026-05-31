import { Field, GraphQLISODateTime, InputType, Int } from '@nestjs/graphql';

@InputType()
export class ApplyEvaluationSchemeInput {
    @Field(() => Int)
    schemeId: number;

    @Field(() => Int, { nullable: true })
    patientId?: number;

    @Field(() => Int, { nullable: true })
    targetUserId?: number;

    @Field(() => Int, { nullable: true })
    therapistId?: number;

    @Field(() => Int, { nullable: true })
    supervisorId?: number;

    @Field(() => Int, { nullable: true })
    responderUserId?: number;

    @Field(() => Int, { nullable: true })
    clinicianId?: number;

    @Field(() => GraphQLISODateTime)
    startDate: Date;

    @Field({ nullable: true })
    timezone?: string;

    @Field(() => Int, { nullable: true })
    maxFutureOccurrences?: number;

    @Field(() => Int, { nullable: true })
    futureGenerationMonths?: number;
}

@InputType()
export class GenerateSchemeOccurrencesInput {
    @Field(() => Int)
    assignmentId: number;
}

@InputType()
export class RegenerateFutureSchemeOccurrencesInput {
    @Field(() => Int)
    assignmentId: number;

    @Field(() => GraphQLISODateTime, { nullable: true })
    from?: Date;
}
