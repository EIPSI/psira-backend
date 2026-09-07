import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/modules/user/models/user.model';
import { Repository } from 'typeorm';
import {
    CreateLanguageInput,
    UpdateLanguageInput,
    UpdateTranslationValueInput,
} from '../dtos/language.input';
import { TranslationBundleDto } from '../dtos/translation-bundle.dto';
import { Language } from '../models/language.model';
import { TranslationKey } from '../models/translation-key.model';
import { TranslationValue } from '../models/translation-value.model';
import { defaultTranslationSeed } from '../seed/default-translation-seed';
import { defaultLanguages, DefaultTranslationSeed } from '../seed/default-translations';

@Injectable()
export class LanguageService implements OnModuleInit {
    private readonly logger = new Logger(LanguageService.name);
    private seedInitialized = false;

    constructor(
        @InjectRepository(Language)
        private readonly languageRepository: Repository<Language>,
        @InjectRepository(TranslationKey)
        private readonly keyRepository: Repository<TranslationKey>,
        @InjectRepository(TranslationValue)
        private readonly valueRepository: Repository<TranslationValue>,
    ) {}

    async onModuleInit(): Promise<void> {
        await this.ensureSeeded(false);
    }

    async languages(): Promise<Language[]> {
        await this.ensureSeeded(false);
        return this.languageRepository.find({ order: { isDefault: 'DESC', name: 'ASC' } });
    }

    async activeLanguages(): Promise<Language[]> {
        await this.ensureSeeded(false);
        return this.languageRepository.find({
            where: { active: true },
            order: { isDefault: 'DESC', name: 'ASC' },
        });
    }

    async language(id: number): Promise<Language> {
        await this.ensureSeeded();
        const language = await this.languageRepository.findOne(id);
        if (!language) throw new BadRequestException('Language not found.');
        return language;
    }

    async createLanguage(input: CreateLanguageInput): Promise<Language> {
        const code = this.normalizeCode(input.code);
        await this.assertUniqueCode(code);
        if (input.isDefault) await this.clearDefaultLanguage();
        const language = this.languageRepository.create({
            ...input,
            code,
            active: input.active !== false,
            isDefault: !!input.isDefault,
            fallbackCode: input.fallbackCode || 'en',
        });
        return this.languageRepository.save(language);
    }

    async updateLanguage(input: UpdateLanguageInput): Promise<Language> {
        const language = await this.language(input.id);
        if (input.code && this.normalizeCode(input.code) !== language.code) {
            const nextCode = this.normalizeCode(input.code);
            await this.assertUniqueCode(nextCode);
            await this.valueRepository.update({ languageId: language.id }, { languageCode: nextCode });
            language.code = nextCode;
        }
        if (input.isDefault) await this.clearDefaultLanguage(language.id);
        language.name = input.name ?? language.name;
        language.nativeName = input.nativeName ?? language.nativeName;
        language.active = input.active ?? language.active;
        language.isDefault = input.isDefault ?? language.isDefault;
        language.fallbackCode = input.fallbackCode === undefined ? language.fallbackCode : input.fallbackCode;
        return this.languageRepository.save(language);
    }

    async translationKeys(namespace?: string): Promise<TranslationKey[]> {
        await this.ensureSeeded(false);
        try {
            const options: any = { order: { namespace: 'ASC', key: 'ASC' } };
            if (namespace) options.where = { namespace };
            const rows = await this.keyRepository.find(options);
            if (rows.length) return rows;
        } catch (error) {
            this.logReadFallback('translation keys', error);
        }
        return this.defaultTranslationKeys(namespace);
    }

    async translationValues(languageCode: string): Promise<TranslationValue[]> {
        await this.ensureSeeded(false);
        const code = this.normalizeCode(languageCode);
        try {
            const rows = await this.valueRepository.find({
                where: { languageCode: code },
                relations: ['translationKey'],
                order: { key: 'ASC' },
            });
            if (rows.length) return rows;
        } catch (error) {
            this.logReadFallback('translation values', error);
        }
        return this.defaultTranslationValues(code);
    }

    async upsertTranslationValue(input: UpdateTranslationValueInput, currentUser?: User): Promise<TranslationValue> {
        const language = await this.getActiveOrExistingLanguage(input.languageCode);
        const key = await this.keyRepository.findOne(input.key);
        if (!key) throw new BadRequestException('Translation key not found.');
        this.assertVariablesArePreserved(key.defaultText || '', input.value || '');
        let value = await this.valueRepository.findOne({ languageId: language.id, key: key.key });
        if (!value) {
            value = this.valueRepository.create({
                languageId: language.id,
                languageCode: language.code,
                key: key.key,
            });
        }
        value.value = input.value || '';
        value.updatedById = currentUser?.id;
        return this.valueRepository.save(value);
    }

    async translationBundle(languageCode?: string): Promise<TranslationBundleDto> {
        await this.ensureSeeded();
        const requestedCode = this.normalizeCode(languageCode || '');
        const defaultLanguage = await this.defaultLanguage();
        const requestedLanguage = requestedCode
            ? await this.languageRepository.findOne({ code: requestedCode, active: true })
            : null;
        const language = requestedLanguage || defaultLanguage;
        const fallbackCode = language.fallbackCode || defaultLanguage.code;
        const fallbackValues = await this.flatValues(fallbackCode);
        const languageValues = language.code === fallbackCode ? {} : await this.flatValues(language.code);
        return {
            languageCode: language.code,
            fallbackCode,
            translationsJson: JSON.stringify(this.unflatten({ ...fallbackValues, ...languageValues })),
        };
    }

    private async seedDefaults(): Promise<void> {
        await this.languageRepository.delete({ code: 'sq' });
        await this.languageRepository.delete({ code: 'sw' });

        for (const defaultLanguage of defaultLanguages) {
            const existing = await this.languageRepository.findOne({ code: defaultLanguage.code });
            if (!existing) {
                await this.languageRepository.save(this.languageRepository.create(defaultLanguage));
            } else {
                existing.name = defaultLanguage.name;
                existing.nativeName = defaultLanguage.nativeName;
                existing.active = defaultLanguage.active;
                existing.isDefault = defaultLanguage.isDefault;
                existing.fallbackCode = defaultLanguage.fallbackCode;
                await this.languageRepository.save(existing);
            }
        }

        const seed = this.loadDefaultTranslationSeed();
        if (!seed) return;

        for (const item of seed.keys) {
            const existing = await this.keyRepository.findOne(item.key);
            const description = item.description || this.describeTranslationKey(item.key, item.namespace);
            const variables = item.variables || this.extractVariables(item.defaultText || '');
            if (!existing) {
                await this.keyRepository.save(
                    this.keyRepository.create({
                        key: item.key,
                        namespace: item.namespace,
                        defaultText: item.defaultText,
                        description,
                        variables,
                        isSystem: true,
                    }),
                );
            } else if (
                existing.namespace !== item.namespace ||
                existing.defaultText !== item.defaultText ||
                !existing.description ||
                JSON.stringify(existing.variables || []) !== JSON.stringify(variables)
            ) {
                existing.namespace = item.namespace;
                existing.defaultText = item.defaultText;
                existing.description = existing.description || description;
                existing.variables = variables;
                existing.isSystem = true;
                await this.keyRepository.save(existing);
            }
        }

        const englishDefaults = this.flatten(seed.values.en || {});
        for (const language of await this.languageRepository.find()) {
            const languageDefaults = this.flatten(seed.values[language.code] || {});
            const flatValues = { ...englishDefaults, ...languageDefaults };
            for (const key of Object.keys(flatValues)) {
                const existing = await this.valueRepository.findOne({ languageId: language.id, key });
                if (!existing) {
                    await this.valueRepository.save(
                        this.valueRepository.create({
                            languageId: language.id,
                            languageCode: language.code,
                            key,
                            value: String(flatValues[key] ?? ''),
                        }),
                    );
                } else if (!existing.value) {
                    existing.value = String(flatValues[key] ?? '');
                    existing.languageCode = language.code;
                    await this.valueRepository.save(existing);
                }
            }
        }
    }

    private async ensureSeeded(throwOnError = true): Promise<void> {
        if (this.seedInitialized) return;
        try {
            await this.seedDefaults();
            this.seedInitialized = true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Unable to seed language translations yet: ${message}`);
            if (throwOnError) throw error;
        }
    }

    private loadDefaultTranslationSeed(): DefaultTranslationSeed | null {
        return defaultTranslationSeed;
    }

    private defaultTranslationKeys(namespace?: string): TranslationKey[] {
        const seed = this.loadDefaultTranslationSeed();
        return (seed?.keys || [])
            .filter(item => !namespace || item.namespace === namespace)
            .map(item => ({
                key: item.key,
                namespace: item.namespace,
                defaultText: item.defaultText,
                description: item.description || this.describeTranslationKey(item.key, item.namespace),
                variables: item.variables || this.extractVariables(item.defaultText || ''),
                isSystem: true,
            } as TranslationKey));
    }

    private defaultTranslationValues(languageCode: string): TranslationValue[] {
        const seed = this.loadDefaultTranslationSeed();
        const englishDefaults = this.flatten(seed?.values?.en || {});
        const languageDefaults = this.flatten(seed?.values?.[languageCode] || {});
        const flatValues = { ...englishDefaults, ...languageDefaults };
        return Object.keys(flatValues).sort().map((key, index) => ({
            id: -(index + 1),
            languageCode,
            key,
            value: String(flatValues[key] ?? ''),
        } as TranslationValue));
    }

    private logReadFallback(label: string, error: unknown): void {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Using default ${label} fallback: ${message}`);
    }

    private async flatValues(languageCode: string): Promise<Record<string, string>> {
        const language = await this.getActiveOrExistingLanguage(languageCode);
        const rows = await this.valueRepository.find({ where: { languageId: language.id } });
        return rows.reduce((acc: Record<string, string>, row) => {
            acc[row.key] = row.value || '';
            return acc;
        }, {} as Record<string, string>);
    }

    private async defaultLanguage(): Promise<Language> {
        let language = await this.languageRepository.findOne({ isDefault: true, active: true });
        if (!language) language = await this.languageRepository.findOne({ code: 'en' });
        if (!language) throw new BadRequestException('Default language is not configured.');
        return language;
    }

    private async getActiveOrExistingLanguage(code: string): Promise<Language> {
        const normalized = this.normalizeCode(code || 'en');
        const language = await this.languageRepository.findOne({ code: normalized });
        if (!language) throw new BadRequestException('Language not found.');
        return language;
    }

    private async assertUniqueCode(code: string): Promise<void> {
        const existing = await this.languageRepository.findOne({ code });
        if (existing) throw new BadRequestException('Language code already exists.');
    }

    private async clearDefaultLanguage(exceptId?: number): Promise<void> {
        const defaults = await this.languageRepository.find({ isDefault: true });
        for (const language of defaults) {
            if (language.id === exceptId) continue;
            language.isDefault = false;
            await this.languageRepository.save(language);
        }
    }

    private normalizeCode(code: string): string {
        return String(code || '').trim().toLowerCase().split('-')[0].split('_')[0];
    }

    private assertVariablesArePreserved(source: string, target: string): void {
        const required = this.extractVariables(source);
        const provided = this.extractVariables(target);
        const missing = required.filter(variable => !provided.includes(variable));
        if (missing.length) {
            throw new BadRequestException(`Translation is missing variables: ${missing.join(', ')}`);
        }
    }

    private extractVariables(text: string): string[] {
        const variables = new Set<string>();
        const regex = /{{\s*([A-Za-z0-9_.-]+)\s*}}/g;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text))) {
            variables.add(match[1]);
        }
        return [...variables];
    }

    private describeTranslationKey(key: string, namespace: string): string {
        const path = key.split('.').slice(1).join(' > ') || key;
        return `Location: ${namespace}. Usage: visible interface text for ${path}.`;
    }

    private flatten(obj: any, prefix = '', out: Record<string, string> = {}): Record<string, string> {
        Object.keys(obj || {}).forEach(key => {
            const next = prefix ? `${prefix}.${key}` : key;
            if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                this.flatten(obj[key], next, out);
            } else {
                out[next] = String(obj[key] ?? '');
            }
        });
        return out;
    }

    private unflatten(flat: Record<string, string>): Record<string, any> {
        return Object.keys(flat).reduce((acc: Record<string, any>, key) => {
            const parts = key.split('.');
            let target = acc;
            parts.forEach((part, index) => {
                if (index === parts.length - 1) {
                    target[part] = flat[key];
                } else {
                    target[part] = target[part] || {};
                    target = target[part];
                }
            });
            return acc;
        }, {} as Record<string, any>);
    }
}
