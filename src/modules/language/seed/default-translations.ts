export const defaultLanguages: {
    code: string;
    name: string;
    nativeName: string;
    active: boolean;
    isDefault: boolean;
    fallbackCode?: string;
}[] = [
    { code: 'en', name: 'English', nativeName: 'English', active: true, isDefault: true },
    { code: 'es', name: 'Spanish', nativeName: 'Español', active: true, isDefault: false, fallbackCode: 'en' },
    { code: 'de', name: 'German', nativeName: 'Deutsch', active: true, isDefault: false, fallbackCode: 'en' },
    { code: 'nl', name: 'Dutch', nativeName: 'Dutch', active: true, isDefault: false, fallbackCode: 'en' },
];

export type DefaultTranslationSeed = {
    keys: { key: string; namespace: string; defaultText: string; description?: string; variables?: string[] }[];
    values: Record<string, any>;
};
