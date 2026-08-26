import { BadRequestException } from '@nestjs/common';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { NotificationEvent } from '../enums/notification-event.enum';
import { NotificationFamily } from '../enums/notification-family.enum';
import { NotificationConfigurationService } from './notification-configuration.service';

describe('NotificationConfigurationService', () => {
    function createService() {
        const configurationRepository = {
            create: jest.fn((value: any) => value),
            save: jest.fn((value: any) => Promise.resolve({ ...value, id: 1 })),
            findOne: jest.fn().mockResolvedValue({ id: 1 }),
            createQueryBuilder: jest.fn(() => ({
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getCount: jest.fn().mockResolvedValue(0),
            })),
        };
        const departmentRepository = { findOne: jest.fn().mockResolvedValue({ id: 1 }) };
        const roleRepository = { findOne: jest.fn().mockResolvedValue({ id: 1 }) };
        const mailTemplateRepository = { findOne: jest.fn().mockResolvedValue({ id: 1 }) };
        const userRepository = { findOne: jest.fn() };
        const patientRepository = { findOne: jest.fn() };
        const service = new NotificationConfigurationService(
            configurationRepository as any,
            departmentRepository as any,
            roleRepository as any,
            mailTemplateRepository as any,
            userRepository as any,
            patientRepository as any,
        );
        return { service };
    }

    it('rejects configurations whose family does not match the event', async () => {
        const { service } = createService();

        await expect(
            service.create({
                channel: NotificationChannel.EMAIL,
                family: NotificationFamily.CASE,
                event: NotificationEvent.ASSESSMENT_ASSIGNED,
                recipientRoleId: 1,
                mailTemplateId: 1,
                active: true,
            }),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows inactive email configurations without a template', async () => {
        const { service } = createService();

        await expect(
            service.create({
                channel: NotificationChannel.EMAIL,
                family: NotificationFamily.ASSESSMENT,
                event: NotificationEvent.ASSESSMENT_ANSWERED,
                recipientRoleId: 1,
                active: false,
            }),
        ).resolves.toEqual(expect.objectContaining({ id: 1 }));
    });
});
