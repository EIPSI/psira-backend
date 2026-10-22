jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
import { ClinicalAccess } from 'src/shared/clinical-access';
import * as moment from 'moment-timezone';
import { EvaluationSchemeType } from '../enums/evaluation-scheme-type.enum';
import { SchemeGenerationService } from './scheme-generation.service';

describe('Fixed scheme timezone', () => {
    const service = Object.create(SchemeGenerationService.prototype);
    function window(timezone: string, date = '2026-10-21T12:00:00Z', relativeDay = 0, minute = 14 * 60 + 45) {
        return service.buildFixedTemplateWindow({
            assignment: { timezone, startDate: new Date(date) }, scheme: { defaultDurationMinutes: 60 },
        }, new Date(date), {
            relativeDay, startMinuteOfDay: minute, durationMinutes: 60, triggerMode: 'BLOCK_START',
        });
    }
    it('programs 14:45 in Argentina at 17:45 UTC regardless of server timezone', () => {
        const result = window('America/Argentina/Buenos_Aires');
        expect(result.deliveryAt.toISOString()).toBe('2026-10-21T17:45:00.000Z');
        expect(result.expirationAt.toISOString()).toBe('2026-10-21T18:45:00.000Z');
    });
    it('explains the reported six-hour difference between display zones', () => {
        const result = window('Africa/Dar_es_Salaam');
        expect(moment.tz(result.deliveryAt, 'Africa/Dar_es_Salaam').format('HH:mm')).toBe('14:45');
        expect(moment.tz(result.deliveryAt, 'America/Argentina/Buenos_Aires').format('HH:mm')).toBe('08:45');
    });
    it('uses the scheme calendar day, not the server calendar day', () => {
        expect(window('America/Argentina/Buenos_Aires', '2026-10-22T01:00:00Z').deliveryAt.toISOString())
            .toBe('2026-10-21T17:45:00.000Z');
    });
    it('converts a fixed respondent-local moment using the rules for its date', () => {
        const result = window('America/New_York', '2026-03-07T12:00:00Z', 1, 9 * 60);
        expect(result.deliveryAt.toISOString()).toBe('2026-03-08T13:00:00.000Z');
        expect(moment.tz(result.deliveryAt, 'America/New_York').format('HH:mm')).toBe('09:00');
    });
});

describe('UTC recurrence arithmetic', () => {
    const service = Object.create(SchemeGenerationService.prototype);
    it('keeps daily and monthly UTC hours across DST', () => {
        expect(service.addDays(new Date('2026-03-07T14:00:00Z'), 1).toISOString())
            .toBe('2026-03-08T14:00:00.000Z');
        expect(service.addMonths(new Date('2026-03-07T14:00:00Z'), 1).toISOString())
            .toBe('2026-04-07T14:00:00.000Z');
    });
    it('uses the respondent offset for the actual date of a later fixed window', () => {
        const result = service.buildFixedTemplateWindow({
            assignment: { timezone: 'America/New_York', startDate: new Date('2026-03-07T14:00:00Z') },
            scheme: { defaultDurationMinutes: 60 },
        }, new Date('2026-03-09T14:00:00Z'), {
            relativeDay: 0, startMinuteOfDay: 9 * 60, durationMinutes: 60, triggerMode: 'BLOCK_START',
        });
        expect(result.deliveryAt.toISOString()).toBe('2026-03-09T13:00:00.000Z');
    });
});

describe('Fixed scheme respondent timezone', () => {
    it('uses the respondent zone instead of the applying professional or client timezone', async () => {
        const service = Object.create(SchemeGenerationService.prototype);
        const assignment = { id: 10 };
        service.schemeRepository = { findOne: jest.fn().mockResolvedValue({
            id: 1, schemeType: EvaluationSchemeType.INDEPENDENT_EVALUATION,
        }) };
        service.userRepository = { findOne: jest.fn().mockResolvedValue({
            id: 2, timezone: 'Europe/Madrid', detectedTimezone: 'America/New_York',
        }) };
        service.assignmentRepository = {
            create: jest.fn(value => value),
            save: jest.fn().mockResolvedValue(assignment),
            findOneOrFail: jest.fn().mockResolvedValue(assignment),
        };
        service.generateOccurrences = jest.fn().mockResolvedValue([]);
        const authorize = jest.spyOn(ClinicalAccess, 'assertTarget').mockResolvedValue(undefined);
        await service.applyScheme({
            schemeId: 1, responderUserId: 2, timezone: 'America/Argentina/Buenos_Aires',
            startDate: new Date('2026-10-21T00:00:00Z'),
        }, { timezone: 'Africa/Dar_es_Salaam' });
        expect(service.assignmentRepository.create.mock.calls[0][0].timezone).toBe('Europe/Madrid');
        expect(service.userRepository.findOne).toHaveBeenCalledWith(2);
        authorize.mockRestore();
    });
});

describe('Fixed scheme calendar dates', () => {
    it('generates each respondent day once when clocks move back at midnight UTC boundary', () => {
        const service = Object.create(SchemeGenerationService.prototype);
        const dates = service.buildRecurrenceDates({
            scheme: { schemeType: EvaluationSchemeType.INDEPENDENT_EVALUATION, defaultRecurrenceRule: 'DAILY' },
            assignment: { timezone: 'Europe/Madrid', startDate: new Date('2026-10-23T22:00:00Z') },
            generationStartsAt: new Date('2026-10-23T22:00:00Z'),
            generationEndsAt: new Date('2026-10-28T00:00:00Z'), maxOccurrences: 4,
        });
        expect(dates.map(date => moment.tz(date, 'Europe/Madrid').format('YYYY-MM-DD')))
            .toEqual(['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']);
    });
});
