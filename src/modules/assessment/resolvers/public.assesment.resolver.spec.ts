jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
import * as CryptoJS from 'crypto-js';
import { configService } from 'src/config/config.service';
import { PublicAssessmentResolver } from './public.assesment.resolver';

describe('Previously emailed assessment links', () => {
    afterEach(() => jest.restoreAllMocks());
    it('resolves existing AES links without requiring the old frontend dependency', () => {
        jest.spyOn(configService, 'getFrontendEncryptionKey').mockReturnValue('test-secret');
        const uuid = '6b07b0c9-4487-4cae-b33a-2f5d44c45066';
        const token = CryptoJS.AES.encrypt(uuid, 'test-secret').toString();
        const resolver = new PublicAssessmentResolver({} as any);
        expect(resolver.resolvePublicAssessmentLink(token)).toBe(uuid);
    });
    it('rejects malformed links with an explicit error', () => {
        jest.spyOn(configService, 'getFrontendEncryptionKey').mockReturnValue('test-secret');
        const resolver = new PublicAssessmentResolver({} as any);
        expect(() => resolver.resolvePublicAssessmentLink('invalid')).toThrow('Assessment link is invalid');
    });
});
