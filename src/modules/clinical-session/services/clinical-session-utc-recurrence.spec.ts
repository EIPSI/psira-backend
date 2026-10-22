jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
import { ClinicalSessionSchedulingService } from './clinical-session-scheduling.service';
import { ClinicalSessionRepeatEndMode, ClinicalSessionRepeatUnit } from '../enums/clinical-session-repeat.enum';

describe('Clinical session UTC recurrence', () => {
    const service = Object.create(ClinicalSessionSchedulingService.prototype);
    it('keeps UTC hours when restructuring a daily series across DST', () => {
        const windows = service.buildRestructureWindows({
            startAt: new Date('2026-03-07T14:00:00Z'), endAt: new Date('2026-03-07T15:00:00Z'),
            every: 1, unit: ClinicalSessionRepeatUnit.DAY,
            endMode: ClinicalSessionRepeatEndMode.AFTER_COUNT, count: 2,
        }, 'America/New_York');
        expect(windows[1].startAt.toISOString()).toBe('2026-03-08T14:00:00.000Z');
        expect(windows[1].endAt.toISOString()).toBe('2026-03-08T15:00:00.000Z');
    });
    it('maps local weekday choices to UTC even when the date differs', () => {
        const windows = service.buildRestructureWindows({
            startAt: new Date('2026-03-07T01:00:00Z'), endAt: new Date('2026-03-07T02:00:00Z'),
            every: 1, unit: ClinicalSessionRepeatUnit.WEEK, repeatOnDays: [5],
            endMode: ClinicalSessionRepeatEndMode.AFTER_COUNT, count: 2,
        }, 'America/New_York');
        expect(windows.map(window => window.startAt.toISOString())).toEqual([
            '2026-03-07T01:00:00.000Z', '2026-03-14T01:00:00.000Z',
        ]);
    });
});
