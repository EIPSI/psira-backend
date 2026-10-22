jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
import { clinicalResponders } from './clinical-responders';
import { ClinicalAccess } from './clinical-access';
import { Patient } from 'src/modules/patient/models/patient.model';
import { PatientCaregiver } from 'src/modules/caregiver/models/patient-caregiver.model';
import { User } from 'src/modules/user/models/user.model';

describe('Configured clinical responders', () => {
    beforeEach(() => {
        jest.spyOn(Patient, 'findOne').mockResolvedValue({ id: 1, userId: 10, caseManagers: [{ id: 20 }] } as Patient);
        jest.spyOn(ClinicalAccess, 'users').mockImplementation(async ids => ids.filter(Boolean).map(id => ({ id } as User)));
    });
    afterEach(() => jest.restoreAllMocks());
    it('uses the session therapist instead of falling back to the patient', async () => {
        expect((await clinicalResponders('THERAPIST', { patientId: 1, therapistId: 20 }, 10)).map(user => user.id)).toEqual([20]);
    });
    it('creates distinct respondents when several roles are configured, without duplicates', async () => {
        expect((await clinicalResponders('PATIENT,THERAPIST,THERAPIST', { patientId: 1, responsibleUserIds: [20, 21] }, 10))
            .map(user => user.id)).toEqual([10, 20, 21]);
    });
    it('uses the therapist as subject and the supervisor as responsible in supervision', async () => {
        const context = { sessionKind: 'SUPERVISION', therapistId: 20, supervisorId: 30 };
        expect((await clinicalResponders('THERAPIST,SUPERVISOR', context, 10)).map(user => user.id)).toEqual([20, 30]);
    });
    it('rejects a missing configured caregiver rather than silently assigning the patient', async () => {
        jest.spyOn(PatientCaregiver, 'find').mockResolvedValue([]);
        await expect(clinicalResponders('CAREGIVER', { patientId: 1 }, 10)).rejects.toThrow('CAREGIVER');
    });
    it('keeps the explicit fallback when the scheme has no configured responder role', async () => {
        expect((await clinicalResponders(undefined, { patientId: 1 }, 40)).map(user => user.id)).toEqual([40]);
    });
});
