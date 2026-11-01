jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
import { AssessmentService } from './assessment.service';
import { ClinicalAccess } from 'src/shared/clinical-access';
import { User } from 'src/modules/user/models/user.model';
import { CalendarEventService } from 'src/modules/calendar/services/calendar-event.service';

describe('Independent evaluations in case history', () => {
    afterEach(() => jest.restoreAllMocks());
    function fixture() {
        const rows = [
            { id: 1, patientId: 10, responderUserId: 100, automationId: 5, departmentIds: [] },
            { id: 2, targetUserId: 100, responderUserId: 100 },
            { id: 3, patientId: 11, responderUserId: 101 },
        ];
        const builder = { leftJoinAndSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue(rows) };
        const service = Object.create(AssessmentService.prototype);
        service.patientRepository = { findOne: jest.fn().mockResolvedValue({ id: 10, userId: 100 }) };
        service.assessmentRepository = { createQueryBuilder: () => builder };
        service.changeQuestionnaireAssessmentStatus = jest.fn().mockResolvedValue(undefined);
        jest.spyOn(ClinicalAccess, 'loadAssessmentScopes').mockResolvedValue(undefined);
        jest.spyOn(ClinicalAccess, 'assessmentDepartments').mockResolvedValue([]);
        jest.spyOn(ClinicalAccess, 'viewer').mockResolvedValue({ id: 20, roles: [], departments: [],
            caseManagedPatients: [{ id: 10, userId: 100 }], supervisedTherapists: [{ id: 200 }] } as User);
        jest.spyOn(ClinicalAccess, 'grants').mockResolvedValue(['assessments.view.assigned']);
        return { service, builder };
    }
    it('includes automated and legacy user-targeted evaluations while filtering unrelated cases', async () => {
        const { service, builder } = fixture();
        const rows = await service.caseHistoryAssessments(10, undefined, { id: 20 });
        expect(rows.map(row => row.id)).toEqual([1, 2]);
        expect(builder.where).toHaveBeenCalledWith('assessment."clinicalSessionId" IS NULL');
        expect(builder.andWhere).toHaveBeenCalledWith(expect.stringContaining('assessment."targetUserId" = :subjectUserId'),
            { patientId: 10, subjectUserId: 100 });
    });
    it('queries supervision by its subject, not by the professional who created the evaluation', async () => {
        const { service, builder } = fixture();
        await service.caseHistoryAssessments(undefined, 200, { id: 20 });
        expect(builder.andWhere).toHaveBeenCalledWith(expect.stringContaining('assessment."patientId" IS NULL'), { therapistId: 200 });
    });
    it('refuses an unbounded case-history request', async () => {
        const { service } = fixture();
        await expect(service.caseHistoryAssessments(undefined, undefined, { id: 20 })).rejects.toThrow('required');
    });
});

describe('Evaluation calendar colors', () => {
    const service = Object.create(CalendarEventService.prototype);
    it('shows unanswered expired evaluations in red even before their stored status is refreshed', () => {
        expect(service.assessmentEventColor({ status: 'OPEN_FOR_COMPLETION', expirationDate: new Date(0) }, false)).toBe('#ffa39e');
        expect(service.assessmentEventColor({ status: 'PLANNED', expirationDate: new Date(0) }, false)).toBe('#ffa39e');
    });
    it('keeps answered evaluations green and future pending evaluations blue', () => {
        expect(service.assessmentEventColor({ expirationDate: new Date(0) }, true)).toBe('#95de64');
        expect(service.assessmentEventColor({ status: 'PLANNED', expirationDate: new Date('2100-01-01') }, false)).toBe('#1d4ed8');
    });
});
