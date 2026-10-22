jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
import { ClinicalAccess, sessionDepartmentIds } from './clinical-access';
import { ClinicalSession } from 'src/modules/clinical-session/models/clinical-session.model';
import { User } from 'src/modules/user/models/user.model';
import { Assessment } from 'src/modules/assessment/models/assessment.model';

const person = (id: number, departments: number[]) => ({ id, departments: departments.map(value => ({ id: value })) });
const session = {
    id: 7, sessionKind: 'CLINICAL', patientId: 10, patient: { ...person(10, [1, 2]), userId: 100 },
    therapistId: 20, therapist: person(20, [2, 3]), responsibleUsers: [person(20, [2, 3])],
} as ClinicalSession;
const manager = { ...person(30, [1]), roles: [], caseManagedPatients: [{ id: 10 }], supervisedTherapists: [] } as User;
const assigned = ['clinical.view.assigned', 'clinical.edit.assigned', 'assessments.view.assigned', 'assessments.edit.assigned'];

describe('Clinical access boundaries', () => {
    afterEach(() => jest.restoreAllMocks());
    it('uses the intersection for clinical and supervision sessions', () => {
        expect(sessionDepartmentIds(session)).toEqual([2]);
        expect(sessionDepartmentIds({ ...session, sessionKind: 'SUPERVISION', therapist: person(20, [2, 3]),
            supervisor: person(40, [3, 4]), responsibleUsers: [person(40, [3, 4])] } as ClinicalSession)).toEqual([3]);
    });
    it('allows a case manager to see another responsible user’s session but not edit it', () => {
        expect(ClinicalAccess.canSession(session, manager, assigned, 'view')).toBe(true);
        expect(ClinicalAccess.canSession(session, manager, assigned, 'edit')).toBe(false);
        expect(ClinicalAccess.canSession(session, { ...manager, id: 20 } as User, assigned, 'edit')).toBe(true);
    });
    it('does not grant departmental access based on the subject’s unrelated department', () => {
        expect(ClinicalAccess.canSession(session, manager, ['clinical.edit.department'], 'edit')).toBe(false);
        expect(ClinicalAccess.canSession(session, { ...manager, departments: [{ id: 2 }] } as User,
            ['clinical.edit.department'], 'edit')).toBe(true);
    });
    it('keeps superadmin access irrespective of departments or case assignment', () => {
        expect(ClinicalAccess.canSession(session, { ...manager, isSuperUser: true } as User, [], 'edit')).toBe(true);
        expect(ClinicalAccess.canSession(session, { ...manager, roles: [{ code: 'SUPER_ADMIN' }] } as User, [], 'edit')).toBe(true);
    });
    it('allows standalone case evaluations but protects evaluations linked to another session', async () => {
        jest.spyOn(ClinicalAccess, 'assessmentDepartments').mockResolvedValue([2]);
        jest.spyOn(ClinicalAccess, 'session').mockResolvedValue(session);
        const assessment = { patientId: 10, responderUserId: 100 } as Assessment;
        expect(await ClinicalAccess.canAssessment(assessment, manager, assigned, 'edit')).toBe(true);
        expect(await ClinicalAccess.canAssessment({ ...assessment, clinicalSessionId: 7 } as Assessment, manager, assigned, 'edit')).toBe(false);
        expect(await ClinicalAccess.canAssessment({ ...assessment, clinicalSessionId: 7 } as Assessment, manager, assigned, 'view')).toBe(true);
    });
    it('preserves an empty automation intersection instead of falling back to the user departments', async () => {
        expect(await ClinicalAccess.assessmentDepartments({ automationId: 1, departmentIds: [] } as Assessment)).toEqual([]);
    });
    it('does not authorize an unassigned caller merely because it knows the patient id', async () => {
        jest.spyOn(ClinicalAccess, 'viewer').mockResolvedValue(manager);
        jest.spyOn(ClinicalAccess, 'grants').mockResolvedValue([]);
        await expect(ClinicalAccess.assertTarget(manager, 10)).rejects.toThrow();
    });
});
