import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class TranslationBundleDto {
    @Field()
    languageCode: string;

    @Field()
    fallbackCode: string;

    @Field()
    translationsJson: string;
}
