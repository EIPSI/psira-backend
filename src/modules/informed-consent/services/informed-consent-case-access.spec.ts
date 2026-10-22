jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
import { ClinicalAccess } from 'src/shared/clinical-access';
import { InformedConsentResponseService } from './informed-consent-response.service';
import { User } from 'src/modules/user/models/user.model';

 describe('Case informed consent access', () => {
    const service = Object.create(InformedConsentResponseService.prototype);
    beforeEach(() => {
        service.userRepository = { findOne: jest.fn().mockResolvedValue({ departments: [{ id: 2 }] }) };
        service.patientRepository = { findOne: jest.fn().mockResolvedValue({ id: 1, departments: [{ id: 2 }] }) };
        jest.spyOn(ClinicalAccess, 'viewer').mockResolvedValue({ id: 20, departments: [{ id: 3 }],
            caseManagedPatients: [{ id: 1 }], roles: [] } as User);
        jest.spyOn(ClinicalAccess, 'grants').mockResolvedValue(['clinical.view.assigned', 'clinical.edit.assigned']);
    });
    afterEach(() => jest.restoreAllMocks());
    it('allows seeing and reviewing the assigned patient regardless of department', async () => {
        const response = { patientId: 1, signerUserId: 10 };
        expect(await service.canAccessResponse(response, { id: 20 })).toBe(true);
        expect(await service.canAccessResponse(response, { id: 20 }, true)).toBe(true);
    });
    it('denies access to unrelated patients even with assigned-case permissions', async () => {
        service.patientRepository.findOne.mockResolvedValue({ id: 2, departments: [{ id: 2 }] });
        expect(await service.canAccessResponse({ patientId: 2, signerUserId: 11 }, { id: 20 })).toBe(false);
        expect(await service.canAccessResponse({ patientId: 2, signerUserId: 11 }, { id: 20 }, true)).toBe(false);
    });
    it('denies revocation before writing a review for an unrelated patient', async () => {
        service.getResponse = jest.fn().mockResolvedValue({ patientId: 2, signerUserId: 11 });
        service.patientRepository.findOne.mockResolvedValue({ id: 2 });
        service.createReview = jest.fn();
        await expect(service.revoke({ responseId: 1 }, { id: 20 })).rejects.toThrow();
        expect(service.createReview).not.toHaveBeenCalled();
    });
 });
