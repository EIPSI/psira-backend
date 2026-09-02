import { Field, Int, ObjectType } from '@nestjs/graphql';
import { InformedConsentKind } from '../enums/informed-consent-kind.enum';
import { InformedConsentResponseStatus } from '../enums/informed-consent-response-status.enum';
import { InformedConsentTrigger } from '../enums/informed-consent-trigger.enum';

@ObjectType()
export class PendingInformedConsentDto {
    @Field(() => Int)
    managementId: number;

    @Field(() => Int)
    modelId: number;

    @Field(() => Int)
    versionId: number;

    @Field()
    title: string;

    @Field(() => InformedConsentKind)
    kind: InformedConsentKind;

    @Field(() => InformedConsentTrigger)
    trigger: InformedConsentTrigger;

    @Field()
    mandatory: boolean;

    @Field()
    blocking: boolean;

    @Field(() => Int, { nullable: true })
    responseId?: number;

    @Field(() => InformedConsentResponseStatus, { nullable: true })
    responseStatus?: InformedConsentResponseStatus;
}
