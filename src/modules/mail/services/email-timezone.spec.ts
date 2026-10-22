jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
import { SendMailService } from './send-mail.service';
import { NotificationDispatchService } from 'src/modules/notification/services/notification-dispatch.service';
import { SettingKey } from 'src/modules/setting/enums/setting-name.enum';

describe('Email dates use the recipient timezone', () => {
    function instance(type: any): any {
        const service = Object.create(type.prototype);
        const settings = {
            [SettingKey.SYSTEM_LOCALE]: 'en',
            [SettingKey.SYSTEM_TIMEZONE]: 'UTC',
            [SettingKey.DATE_FORMAT]: 'YYYY-MM-DD',
            [SettingKey.TIME_FORMAT]: 'HH:mm',
            [SettingKey.DATETIME_FORMAT]: 'YYYY-MM-DD HH:mm',
        };
        service.settingService = { getKey: async (key: string) => settings[key] };
        return service;
    }
    it('formats the same instant in each recipient zone for assignment emails and notifications', async () => {
        const instant = new Date('2026-10-21T17:45:00Z');
        for (const type of [SendMailService, NotificationDispatchService]) {
            const service = instance(type);
            expect(await service.formatDateTime(instant, { timezone: 'America/Argentina/Buenos_Aires' }))
                .toBe('2026-10-21 14:45');
            expect(await service.formatDateTime(instant, { detectedTimezone: 'Asia/Tokyo' }))
                .toBe('2026-10-22 02:45');
        }
    });
    it('formats summary rows with the same personal reference', async () => {
        const service = instance(NotificationDispatchService);
        const html = await service.buildAssessmentsTable([{
            id: 1, assessmentType: { name: 'Test' }, deliveryDate: new Date('2026-10-21T17:45:00Z'),
        }], { timezone: 'America/Argentina/Buenos_Aires' });
        expect(html).toContain('2026-10-21 14:45');
    });
});
