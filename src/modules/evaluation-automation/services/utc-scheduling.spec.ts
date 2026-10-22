jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
import { EvaluationAutomationEngineService } from './evaluation-automation-engine.service';
import { EvaluationAutomationManagementService } from './evaluation-automation-management.service';
import { EvaluationAutomationDelayUnit } from '../enums/evaluation-automation-delay-unit.enum';
import { NotificationPreferenceService } from '../../notification/services/notification-preference.service';
import { NotificationPeriodicUnit } from '../../notification/enums/notification-periodic-unit.enum';

describe('Stored UTC instants govern scheduling', () => {
    const engine = Object.create(EvaluationAutomationEngineService.prototype);
    const management = Object.create(EvaluationAutomationManagementService.prototype);
    const preferences = Object.create(NotificationPreferenceService.prototype);
    const start = new Date('2026-03-07T14:00:00Z');
    const expected = new Date('2026-03-08T14:00:00Z');

    it('automation delay is independent of server DST', () => {
        expect(engine.calculateScheduledAt({ delayAmount: 1, delayUnit: EvaluationAutomationDelayUnit.DAYS }, start))
            .toEqual(expected);
    });
    it('preview and execution agree across server DST', () => {
        const RealDate = Date;
        jest.spyOn(global as any, 'Date').mockImplementation((value?: any) =>
            value === undefined ? new RealDate(start) : new RealDate(value));
        try {
            expect(management.calculatePreviewScheduledAt({ delayAmount: 1, delayUnit: EvaluationAutomationDelayUnit.DAYS }))
                .toEqual(expected);
        } finally {
            jest.restoreAllMocks();
        }
    });
    it('periodic notifications are due at the stored UTC time', () => {
        const preference = {
            enabled: true, periodicEnabled: true, periodicEvery: 1,
            periodicUnit: NotificationPeriodicUnit.DAYS, lastPeriodicSentAt: start,
        };
        expect(preferences.isPeriodicDue(preference, new Date('2026-03-08T13:30:00Z'))).toBe(false);
        expect(preferences.isPeriodicDue(preference, expected)).toBe(true);
        expect(preferences.periodStart(preference, expected)).toEqual(start);
    });
});
