import { userTimezone } from './user-timezone';

describe('Personal timezone precedence', () => {
    it('prefers the manual choice to the detected zone and the global fallback', () => {
        expect(userTimezone({ timezone: 'Asia/Tokyo', detectedTimezone: 'Europe/Madrid' }, 'UTC')).toBe('Asia/Tokyo');
    });
    it('uses the detected zone in automatic mode', () => {
        expect(userTimezone({ timezone: null, detectedTimezone: 'America/Argentina/Buenos_Aires' })).toBe('America/Argentina/Buenos_Aires');
    });
    it('uses UTC when there is no known zone, or the configured global fallback', () => {
        expect(userTimezone()).toBe('UTC');
        expect(userTimezone(undefined, 'Europe/Madrid')).toBe('Europe/Madrid');
        expect(userTimezone({ timezone: 'bad-zone', detectedTimezone: 'bad-zone' }, 'bad-zone')).toBe('UTC');
    });
});
