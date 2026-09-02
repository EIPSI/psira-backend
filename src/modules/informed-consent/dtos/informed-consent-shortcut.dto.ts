import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class InformedConsentShortcutDto {
    @Field()
    group: string;

    @Field()
    label: string;

    @Field()
    token: string;

    @Field()
    description: string;
}
