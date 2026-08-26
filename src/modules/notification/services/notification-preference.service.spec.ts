import { BadRequestException } from '@nestjs/common';
import { NotificationEvent } from '../enums/notification-event.enum';
import { NotificationPeriodicUnit } from '../enums/notification-periodic-unit.enum';
import { NotificationPreferenceService } from './notification-preference.service';

describe('NotificationPreferenceService', () => {
    function createService() {
        const preferenceRepository = {
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn((value: any) => value),
            save: jest.fn((value: any) => Promise.resolve({ ...value, id: 1 })),
        };
        const patientRepository = {
            findOne: jest.fn().mockResolvedValue({
                id: 1,
                caseManagers: [{ id: 10 }, { id: 11 }],
            }),
        };
        const userRepository = {
            findOne: jest.fn().mockResolvedValue({
                id: 2,
                supervisors: [{ id: 20 }],
            }),
        };
        const service = new NotificationPreferenceService(
            preferenceRepository as any,
            patientRepository as any,
            userRepository as any,
        );
        return { service, preferenceRepository, patientRepository, userRepository };
    }

    it('requires exactly one preference scope', async () => {
        const { service } = createService();

        await expect(service.getOrCreate({})).rejects.toBeInstanceOf(BadRequestException);
        await expect(
            service.getOrCreate({ patientId: 1, therapistId: 2 }),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects excluded recipients outside the responsible users', async () => {
        const { service } = createService();

        await expect(
            service.update({
                patientId: 1,
                excludedRecipientIds: [99],
            }),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('stores valid periodic preferences', async () => {
        const { service } = createService();

        await expect(
            service.update({
                patientId: 1,
                periodicEnabled: true,
                periodicEvery: 2,
                periodicUnit: NotificationPeriodicUnit.WEEKS,
                enabledEvents: [
                    NotificationEvent.ASSESSMENT_ANSWERED,
                    NotificationEvent.ASSESSMENT_PERIODIC_SUMMARY,
                ],
                excludedRecipientIds: [10],
            }),
        ).resolves.toEqual(
            expect.objectContaining({
                id: 1,
                periodicEnabled: true,
                periodicEvery: 2,
                excludedRecipientIds: [10],
            }),
        );
    });
});
