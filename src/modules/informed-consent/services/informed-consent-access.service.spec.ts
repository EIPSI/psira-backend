jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
import { InformedConsentAccessService } from './informed-consent-access.service';
import { InformedConsentResponseService } from './informed-consent-response.service';

 describe('Mandatory informed consent access', () => {
    function createResponses(mandatory: boolean, status?: string) {
        const service = new InformedConsentResponseService(
            {} as any, {} as any, {} as any, {} as any, {} as any,
            {} as any, {} as any, {} as any, {} as any,
            { getKey: jest.fn().mockResolvedValue(true) } as any,
        );
        jest.spyOn(service as any, 'loadUserScope').mockResolvedValue({ id: 1 });
        jest.spyOn(service as any, 'applicableManagements').mockResolvedValue([{
            id: 1, modelId: 1, mandatory, model: { currentPublishedVersionId: 1 },
        }]);
        jest.spyOn(service as any, 'triggerAppliesToUser').mockResolvedValue(true);
        jest.spyOn(service as any, 'latestResponse').mockResolvedValue(status ? { status } : undefined);
        return service;
    }

    it('blocks mandatory consent even when no response has ever been created', async () => {
        await expect(createResponses(true).hasBlockingPending(1)).resolves.toBe(true);
    });
    it('allows unanswered optional consent and already submitted mandatory consent', async () => {
        await expect(createResponses(false).hasBlockingPending(1)).resolves.toBe(false);
        await expect(createResponses(true, 'SUBMITTED').hasBlockingPending(1)).resolves.toBe(false);
    });
    it('allows loading and submitting consent while blocking unrelated operations', async () => {
        const access = new InformedConsentAccessService(createResponses(true), {
            getKey: jest.fn().mockResolvedValue(true),
        } as any);
        await expect(access.shouldBlockOperation(1, 'patients')).resolves.toBe(true);
        await expect(access.shouldBlockOperation(1, 'pendingInformedConsentModel')).resolves.toBe(false);
        await expect(access.shouldBlockOperation(1, 'submitInformedConsentResponse')).resolves.toBe(false);
    });
 });
