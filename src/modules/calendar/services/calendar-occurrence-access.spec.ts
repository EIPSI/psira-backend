jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
import { CalendarOccurrenceService } from './calendar-occurrence.service';
import { CalendarEventService } from './calendar-event.service';
import { CalendarOccurrenceResolver } from '../resolvers/calendar-occurrence.resolver';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { ClinicalAccess } from 'src/shared/clinical-access';

describe('Calendar mutation boundaries', () => {
    afterEach(() => jest.restoreAllMocks());
    it('allows the assigned-case creation permission at the calendar endpoint', () => {
        const permissions = Reflect.getMetadata('or_permissions', CalendarOccurrenceResolver.prototype.createAssessmentOccurrence);
        expect(permissions).toContain(PermissionEnum.ASSESSMENTS_CREATE_ASSIGNED);
        expect(Reflect.getMetadata('permissions', CalendarOccurrenceResolver.prototype.createAssessmentOccurrence)).toBeUndefined();
    });
    it('refuses to move an evaluation before writing when the caller cannot edit it', async () => {
        const service = Object.create(CalendarOccurrenceService.prototype);
        service.occurrenceRepository = { findOneOrFail: jest.fn().mockResolvedValue({ id: 1, assessments: [{ id: 2 }] }), save: jest.fn() };
        jest.spyOn(ClinicalAccess, 'assertAssessment').mockRejectedValue(new Error('different department'));
        await expect(service.detachAndMoveOccurrence(1, new Date(0), new Date(60000), { id: 20 })).rejects.toThrow('different department');
        expect(service.occurrenceRepository.save).not.toHaveBeenCalled();
    });
    it('does not move session dates through an endpoint that would leave resources behind', async () => {
        const service = Object.create(CalendarOccurrenceService.prototype);
        service.occurrenceRepository = { findOneOrFail: jest.fn().mockResolvedValue({ id: 1, clinicalSession: { id: 3 } }), save: jest.fn() };
        await expect(service.detachAndMoveOccurrence(1, new Date(0), new Date(60000), { id: 20 })).rejects.toThrow('through their session');
        expect(service.occurrenceRepository.save).not.toHaveBeenCalled();
    });
    it('retains all responsible users and the supervision kind when determining event edit access', () => {
        const service = Object.create(CalendarEventService.prototype);
        const session = { id: 1, sessionKind: 'SUPERVISION', therapistId: 10, supervisorId: 20,
            therapist: { id: 10, departments: [{ id: 1 }] }, responsibleUsers: [{ id: 20 }, { id: 21 }] };
        const viewer = { id: 21, roles: [], departments: [], supervisedTherapists: [{ id: 10 }] };
        expect(service.canAccessSession(session, [], viewer, [{ name: 'clinical.edit.assigned' }], 'edit')).toBe(true);
    });
});
