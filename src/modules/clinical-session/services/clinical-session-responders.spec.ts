jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
import { ClinicalSessionSchedulingService } from './clinical-session-scheduling.service';
import { SchemeGenerationService } from 'src/modules/evaluation-scheme/services/scheme-generation.service';
import { ClinicalAccess } from 'src/shared/clinical-access';
import { Patient } from 'src/modules/patient/models/patient.model';
import { User } from 'src/modules/user/models/user.model';

describe('Responders in both session generation paths', () => {
    const templates = [{ id: 1, sessionTemplateId: 1, resourceKind: 'PRE_ASSESSMENT', defaultResponderRole: 'THERAPIST' },
        { id: 2, sessionTemplateId: 1, resourceKind: 'PRE_ASSESSMENT', defaultResponderRole: 'PATIENT,THERAPIST' }];
    beforeEach(() => {
        jest.spyOn(Patient, 'findOne').mockResolvedValue({ id: 10, userId: 100 } as Patient);
        jest.spyOn(ClinicalAccess, 'users').mockImplementation(async ids => ids.map(id => ({ id, email: `test-${id}@example.test` } as User)));
    });
    afterEach(() => jest.restoreAllMocks());
    it('uses configured responders when adding scheme resources to an existing session', async () => {
        const service = Object.create(ClinicalSessionSchedulingService.prototype);
        service.sessionTemplateRepository = { find: jest.fn().mockResolvedValue([{ id: 1, schemeId: 1 }]) };
        service.schemeResourceTemplateRepository = { find: jest.fn().mockResolvedValue(templates) };
        service.patientRepository = { findOne: jest.fn().mockResolvedValue({ id: 10, userId: 100 }) };
        service.resourceAppliesToSession = jest.fn().mockReturnValue(true);
        const resources = await service.buildResourcesFromScheme({ schemeId: 1, sessionNumber: 1, patientId: 10,
            therapistId: 20, responsibleUserIds: [20], sessionKind: 'CLINICAL' });
        expect(resources.map(resource => [resource.resourceTemplateId, resource.responderUserId])).toEqual([[1, 20], [2, 100], [2, 20]]);
    });
    it('uses the same responders when generating a session from a scheme assignment', async () => {
        const service = Object.create(SchemeGenerationService.prototype);
        const input = await service.buildClinicalSessionInput({ assignment: { patientId: 10, therapistId: 20 },
            scheme: {}, responsibleUserIds: [20], responderUserId: 100 }, { sessionKind: 'CLINICAL' }, templates, new Date(), new Date());
        expect(input.resources.map(resource => [resource.resourceTemplateId, resource.responderUserId])).toEqual([[1, 20], [2, 100], [2, 20]]);
        expect(input.resources[0].receiverEmail).toBe('test-20@example.test');
    });
    it('checks the target before removing future occurrences during regeneration', async () => {
        const service = Object.create(SchemeGenerationService.prototype);
        service.assignmentRepository = { findOneOrFail: jest.fn().mockResolvedValue({ patientId: 10 }) };
        service.removeRegenerableFutureOccurrences = jest.fn();
        jest.spyOn(ClinicalAccess, 'assertTarget').mockRejectedValue(new Error('not assigned'));
        await expect(service.regenerateFutureOccurrences({ assignmentId: 1 }, { id: 20 })).rejects.toThrow('not assigned');
        expect(service.removeRegenerableFutureOccurrences).not.toHaveBeenCalled();
    });
    it('preflights future session access before saving an update with propagation', async () => {
        const service = Object.create(ClinicalSessionSchedulingService.prototype);
        service.clinicalSessionRepository = { findOneOrFail: jest.fn().mockResolvedValue({ id: 1 }), save: jest.fn() };
        service.assertCanManageSession = jest.fn().mockResolvedValue(undefined);
        service.futureSessionsFrom = jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);
        jest.spyOn(ClinicalAccess, 'viewer').mockResolvedValue({ id: 20 } as User);
        jest.spyOn(ClinicalAccess, 'grants').mockResolvedValue(['clinical.edit.assigned']);
        jest.spyOn(ClinicalAccess, 'session').mockImplementation(async id => ({ id, responsibleUsers: [{ id: id === 1 ? 20 : 21 }] } as any));
        await expect(service.updateClinicalSession({ clinicalSessionId: 1, propagateFuture: true }, { id: 20 })).rejects.toThrow('another responsible');
        expect(service.clinicalSessionRepository.save).not.toHaveBeenCalled();
    });

});
