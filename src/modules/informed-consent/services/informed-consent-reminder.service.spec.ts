jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
import { InformedConsentReminderService } from './informed-consent-reminder.service';
import { InformedConsentManagement } from '../models/informed-consent-management.model';
import { NotificationLog } from 'src/modules/notification/models/notification-log.model';

describe('Consent reminders', () => {
    afterEach(() => jest.restoreAllMocks());
    function setup(offsets: number[], logs: any[]) {
        jest.spyOn(InformedConsentManagement, 'findOne').mockResolvedValue({
            id: 1, reminderOffsets: offsets, reminderUnit: 'DAYS', model: { name: 'Consent' },
        } as any);
        jest.spyOn(NotificationLog, 'find').mockImplementation(async () => logs);
        const dispatchUserEvent = jest.fn(async (input) => {
            logs.push({ createdAt: new Date(), metadata: input.metadata });
        });
        const service = new InformedConsentReminderService({
            pendingForUser: jest.fn().mockResolvedValue([{ managementId: 1, versionId: 2 }]),
            publicResponseLinkForUser: jest.fn().mockReturnValue('https://example.test/consent'),
        } as any, { dispatchUserEvent } as any);
        return { service, dispatchUserEvent };
    }
    it('sends the initial email once even when the task runs repeatedly', async () => {
        const { service, dispatchUserEvent } = setup([1, 3], []);
        await (service as any).sendForUser({ id: 1, email: 'person@example.test' });
        await (service as any).sendForUser({ id: 1, email: 'person@example.test' });
        expect(dispatchUserEvent).toHaveBeenCalledTimes(1);
    });
    it('waits for configured deadlines and avoids a backlog of old reminders', async () => {
        const logs = [{ createdAt: new Date(Date.now() - 4 * 86400000), metadata: { consentReminderKey: '1:2:initial' } }];
        const { service, dispatchUserEvent } = setup([1, 3, 7], logs);
        await (service as any).sendForUser({ id: 1 });
        await (service as any).sendForUser({ id: 1 });
        expect(dispatchUserEvent).toHaveBeenCalledTimes(1);
        expect(dispatchUserEvent.mock.calls[0][0].metadata.consentReminderKey).toBe('1:2:DAYS:3');
    });
});
