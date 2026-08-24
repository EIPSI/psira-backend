import { Field, GraphQLISODateTime, InputType, Int } from '@nestjs/graphql';
import { TreatmentCycleKind } from '../enums/treatment-cycle-kind.enum';

@InputType()
export class TreatmentCycleListFilterInput {
    @Field(() => TreatmentCycleKind, { nullable: true })
    cycleKind?: TreatmentCycleKind;

    @Field(() => Int, { nullable: true })
    patientId?: number;

    @Field(() => Int, { nullable: true })
    therapistId?: number;

    @Field(() => Boolean, { nullable: true })
    activeOnly?: boolean;
}

@InputType()
export class FinalizeTreatmentCycleInput {
    @Field(() => Int, { nullable: true })
    treatmentCycleId?: number;

    @Field(() => TreatmentCycleKind, { nullable: true })
    cycleKind?: TreatmentCycleKind;

    @Field(() => Int, { nullable: true })
    patientId?: number;

    @Field(() => Int, { nullable: true })
    therapistId?: number;

    @Field(() => GraphQLISODateTime, { nullable: true })
    finalizedAt?: Date;

    @Field(() => Int, { nullable: true })
    finalizationReasonId?: number;

    @Field(() => String, { nullable: true })
    finalizationOtherReason?: string;

    @Field(() => String, { nullable: true })
    finalizationNote?: string;

    @Field(() => Int, { nullable: true })
    lastSessionNumber?: number;

    @Field(() => [Int], { nullable: true })
    excludedAutomationIds?: number[];
}

@InputType()
export class CancelTreatmentCycleFinalizationInput {
    @Field(() => Int)
    treatmentCycleId: number;

    @Field(() => String, { nullable: true })
    note?: string;
}

@InputType()
export class StartNewTreatmentCycleInput {
    @Field(() => Int, { nullable: true })
    previousTreatmentCycleId?: number;

    @Field(() => TreatmentCycleKind, { nullable: true })
    cycleKind?: TreatmentCycleKind;

    @Field(() => Int, { nullable: true })
    patientId?: number;

    @Field(() => Int, { nullable: true })
    therapistId?: number;

    @Field(() => GraphQLISODateTime, { nullable: true })
    startedAt?: Date;

    @Field(() => Int, { nullable: true })
    newTreatmentReasonId?: number;

    @Field(() => String, { nullable: true })
    newTreatmentOtherReason?: string;

    @Field(() => String, { nullable: true })
    newTreatmentNote?: string;

    @Field(() => [Int], { nullable: true })
    excludedAutomationIds?: number[];
}

@InputType()
export class CaseHistoryFilterInput {
    @Field(() => TreatmentCycleKind, { nullable: true })
    cycleKind?: TreatmentCycleKind;

    @Field(() => Int, { nullable: true })
    patientId?: number;

    @Field(() => Int, { nullable: true })
    therapistId?: number;

    @Field(() => GraphQLISODateTime, { nullable: true })
    from?: Date;

    @Field(() => GraphQLISODateTime, { nullable: true })
    to?: Date;

    @Field(() => String, { nullable: true })
    sortDirection?: 'ASC' | 'DESC';
}

@InputType()
export class CreateCaseHistoryNoteInput {
    @Field(() => TreatmentCycleKind)
    cycleKind: TreatmentCycleKind;

    @Field(() => Int, { nullable: true })
    patientId?: number;

    @Field(() => Int, { nullable: true })
    therapistId?: number;

    @Field(() => Int, { nullable: true })
    treatmentCycleId?: number;

    @Field(() => GraphQLISODateTime, { nullable: true })
    occurredAt?: Date;

    @Field(() => String)
    title: string;

    @Field(() => String, { nullable: true })
    content?: string;
}
