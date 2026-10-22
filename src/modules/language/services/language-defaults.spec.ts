jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
import { LanguageService } from './language.service';

describe('Localized translation defaults', () => {
    async function seedValue(value: string, updatedById?: number): Promise<string> {
        const existing = { key: 'evaluationSchemes.sessionBased', value, updatedById };
        const languages = {
            delete: jest.fn(), findOne: jest.fn().mockResolvedValue({}), save: jest.fn(),
            find: jest.fn().mockResolvedValue([{ id: 1, code: 'es' }]),
        };
        const keys = { findByIds: jest.fn().mockResolvedValue([]), create: jest.fn(row => row), save: jest.fn() };
        const values = { find: jest.fn().mockResolvedValue([existing]), save: jest.fn() };
        const service = new LanguageService(languages as any, keys as any, values as any);
        jest.spyOn(service as any, 'loadDefaultTranslationSeed').mockReturnValue({
            keys: [{ key: existing.key, namespace: 'evaluationSchemes', defaultText: 'Session-based' }],
            values: {
                en: { evaluationSchemes: { sessionBased: 'Session-based' } },
                es: { evaluationSchemes: { sessionBased: 'Por sesiones' } },
            },
        });
        await (service as any).seedDefaults();
        return existing.value;
    }

    it('replaces an untouched English fallback with its localized default', async () => {
        expect(await seedValue('Session-based')).toBe('Por sesiones');
    });
    it('preserves wording explicitly edited by a user, including English', async () => {
        expect(await seedValue('Session-based', 7)).toBe('Session-based');
        expect(await seedValue('Texto personalizado', 7)).toBe('Texto personalizado');
    });
    it('repairs a placeholder equal to its translation key', async () => {
        expect(await seedValue('evaluationSchemes.sessionBased')).toBe('Por sesiones');
    });
});
