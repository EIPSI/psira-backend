import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/models/user.model';
import { Language } from './models/language.model';
import { TranslationKey } from './models/translation-key.model';
import { TranslationValue } from './models/translation-value.model';
import { LanguageResolver } from './resolvers/language.resolver';
import { LanguageService } from './services/language.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Language,
            TranslationKey,
            TranslationValue,
            User,
        ]),
    ],
    providers: [LanguageResolver, LanguageService],
    exports: [LanguageService],
})
export class LanguageModule {}
