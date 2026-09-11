import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from 'src/modules/auth/auth-user.decorator';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import { UsePermission } from 'src/modules/permission/decorators/permission.decorator';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { PermissionGuard } from 'src/modules/permission/guards/permission.guard';
import { User } from 'src/modules/user/models/user.model';
import {
    CreateLanguageInput,
    UpdateLanguageInput,
    UpdateTranslationValueInput,
} from '../dtos/language.input';
import { TranslationBundleDto } from '../dtos/translation-bundle.dto';
import { Language } from '../models/language.model';
import { TranslationKey } from '../models/translation-key.model';
import { TranslationValue } from '../models/translation-value.model';
import { LanguageService } from '../services/language.service';

@Resolver(() => Language)
export class LanguageResolver {
    constructor(private readonly languageService: LanguageService) {}

    @Query(() => TranslationBundleDto)
    languageBundle(
        @Args('languageCode', { nullable: true }) languageCode?: string,
    ): Promise<TranslationBundleDto> {
        return this.languageService.translationBundle(languageCode);
    }

    @Query(() => [Language])
    activeLanguages(): Promise<Language[]> {
        return this.languageService.activeLanguages();
    }

    @Query(() => [Language])
    @UseGuards(GqlAuthGuard)
    languages(): Promise<Language[]> {
        return this.languageService.languages();
    }

    @Query(() => Language)
    @UseGuards(GqlAuthGuard)
    language(@Args('id', { type: () => Int }) id: number): Promise<Language> {
        return this.languageService.language(id);
    }

    @Query(() => [TranslationKey])
    @UseGuards(GqlAuthGuard)
    translationKeys(
        @Args('namespace', { nullable: true }) namespace?: string,
    ): Promise<TranslationKey[]> {
        return this.languageService.translationKeys(namespace);
    }

    @Query(() => [TranslationValue])
    @UseGuards(GqlAuthGuard)
    translationValues(
        @Args('languageCode') languageCode: string,
    ): Promise<TranslationValue[]> {
        return this.languageService.translationValues(languageCode);
    }

    @Mutation(() => Language)
    @UseGuards(GqlAuthGuard, PermissionGuard)
    @UsePermission(PermissionEnum.SETTINGS_EDIT_ALL)
    createLanguage(@Args('input') input: CreateLanguageInput): Promise<Language> {
        return this.languageService.createLanguage(input);
    }

    @Mutation(() => Language)
    @UseGuards(GqlAuthGuard, PermissionGuard)
    @UsePermission(PermissionEnum.SETTINGS_EDIT_ALL)
    updateLanguage(@Args('input') input: UpdateLanguageInput): Promise<Language> {
        return this.languageService.updateLanguage(input);
    }

    @Mutation(() => TranslationValue)
    @UseGuards(GqlAuthGuard, PermissionGuard)
    @UsePermission(PermissionEnum.SETTINGS_EDIT_ALL)
    updateTranslationValue(
        @Args('input') input: UpdateTranslationValueInput,
        @CurrentUser() currentUser: User,
    ): Promise<TranslationValue> {
        return this.languageService.upsertTranslationValue(input, currentUser);
    }
}
