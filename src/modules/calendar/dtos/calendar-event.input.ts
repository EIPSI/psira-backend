import { Field, GraphQLISODateTime, InputType, Int } from '@nestjs/graphql';
import { ClinicalSessionKind } from 'src/modules/clinical-session/enums/clinical-session-kind.enum';
import { CalendarEventType } from '../enums/calendar-event-type.enum';

@InputType()
export class CalendarEventFilterInput {
    @Field(() => GraphQLISODateTime)
    from: Date;

    @Field(() => GraphQLISODateTime)
    to: Date;

    @Field(() => Int, { nullable: true })
    patientId?: number;

    @Field(() => Int, { nullable: true })
    therapistId?: number;

    @Field(() => Int, { nullable: true })
    supervisorId?: number;

    @Field(() => [CalendarEventType], { nullable: true })
    types?: CalendarEventType[];

    @Field(() => ClinicalSessionKind, { nullable: true })
    sessionKind?: ClinicalSessionKind;

    @Field(() => Boolean, { nullable: true })
    includeCancelled?: boolean;
}
