import { Field, InputType, Int, PartialType } from '@nestjs/graphql';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

@InputType()
export class CreateLanguageInput {
    @Field()
    @IsString()
    code: string;

    @Field()
    @IsString()
    name: string;

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    nativeName?: string;

    @Field({ nullable: true })
    @IsOptional()
    @IsBoolean()
    active?: boolean;

    @Field({ nullable: true })
    @IsOptional()
    @IsBoolean()
    isDefault?: boolean;

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    fallbackCode?: string;
}

@InputType()
export class UpdateLanguageInput extends PartialType(CreateLanguageInput) {
    @Field(() => Int)
    id: number;
}

@InputType()
export class UpdateTranslationValueInput {
    @Field()
    @IsString()
    languageCode: string;

    @Field()
    @IsString()
    key: string;

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    value?: string;
}
