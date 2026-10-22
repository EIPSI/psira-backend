jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
import { BadRequestException } from '@nestjs/common';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { NotificationEvent } from '../enums/notification-event.enum';
import { NotificationFamily } from '../enums/notification-family.enum';
import { NotificationConfigurationService } from './notification-configuration.service';

describe('NotificationConfigurationService', () => {
    function createService() {
        const configurationRepository = {
            update: jest.fn().mockResolvedValue({ affected: 1 }),
            manager: { transaction: jest.fn() },
            create: jest.fn((value: any) => value),
            save: jest.fn((value: any) => Promise.resolve({ ...value, id: 1 })),
            findOne: jest.fn().mockResolvedValue({ id: 1 }),
            createQueryBuilder: jest.fn(() => ({
                innerJoinAndSelect: jest.fn().mockReturnThis(),
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockResolvedValue({ id: 1, recipientRole: { id: 1 } }),
                getMany: jest.fn().mockResolvedValue([{ id: 1, recipientRole: { id: 1 } }]),
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
            {} as any,
        );
        return { service, configurationRepository };
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
    it('updates foreign keys without persisting stale loaded relations, including explicit department clearing', async () => {
        const { service, configurationRepository } = createService();
        await service.update({ id: 1, departmentId: null, recipientRoleId: 2, mailTemplateId: 3,
            channel: NotificationChannel.EMAIL, family: NotificationFamily.ASSESSMENT,
            event: NotificationEvent.ASSESSMENT_ASSIGNED, active: true });
        expect(configurationRepository.update).toHaveBeenCalledWith(1, expect.objectContaining({
            departmentId: null, recipientRoleId: 2, mailTemplateId: 3,
        }));
        expect(configurationRepository.save).not.toHaveBeenCalled();
        const values = configurationRepository.update.mock.calls[0][1];
        expect(values).not.toHaveProperty('recipientRole');
        expect(values).not.toHaveProperty('department');
        expect(values).not.toHaveProperty('mailTemplate');
    });

    it('writes every department in the same transaction and propagates a failure', async () => {
        const { service, configurationRepository } = createService();
        const update = jest.fn().mockResolvedValue({ affected: 1 });
        const save = jest.fn().mockRejectedValue(new Error('second department failed'));
        const repository = { findOne: jest.fn().mockResolvedValue({ id: 1 }), update, save,
            create: jest.fn(value => value) };
        configurationRepository.manager.transaction.mockImplementation(work => work({ getRepository: () => repository }));
        await expect(service.saveScopes({ id: 1, departmentIds: [2, 3], recipientRoleId: 2, mailTemplateId: 3,
            channel: NotificationChannel.EMAIL, family: NotificationFamily.ASSESSMENT,
            event: NotificationEvent.ASSESSMENT_ASSIGNED, active: true })).rejects.toThrow('second department failed');
        expect(configurationRepository.manager.transaction).toHaveBeenCalledTimes(1);
        expect(update).toHaveBeenCalledWith(1, expect.objectContaining({ departmentId: 2 }));
        expect(save).toHaveBeenCalledWith(expect.objectContaining({ departmentId: 3 }));
        expect(configurationRepository.update).not.toHaveBeenCalled();
        expect(configurationRepository.save).not.toHaveBeenCalled();
    });

});
