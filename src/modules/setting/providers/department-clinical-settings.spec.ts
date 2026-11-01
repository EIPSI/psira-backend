jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
import { SettingService } from './setting.service';
import { ClinicalSessionFollowUpSetting } from 'src/modules/clinical-session/models/clinical-session-follow-up-setting.model';
import { ClinicalSessionSchedulingService } from 'src/modules/clinical-session/services/clinical-session-scheduling.service';
import { ClinicalAccess } from 'src/shared/clinical-access';
import { User } from 'src/modules/user/models/user.model';

describe('Department clinical settings', () => {
    afterEach(() => jest.restoreAllMocks());
    it('inherits global settings without inventing local role assignments', async () => {
        jest.spyOn(ClinicalSessionFollowUpSetting, 'findOne').mockResolvedValue({ editWindowDays: 7, dashboardLookaheadDays: 1 } as any);
        jest.spyOn(ClinicalSessionFollowUpSetting, 'find').mockResolvedValue([]);
        const service = new SettingService();
        jest.spyOn(service, 'getKey').mockImplementation(async key => key === 'patientCaseManagerRoleCodes' ? ['SUPER_ADMIN', 'THERAPIST'] : ['SUPERVISOR']);
        const result = await service.clinicalSettings([10]);
        expect(result.editWindowDays).toBe(7);
        expect(result.patientCaseManagerRoleCodes).toEqual(['SUPER_ADMIN', 'THERAPIST']);
    });
    it('uses department overrides without modifying other departments', async () => {
        jest.spyOn(ClinicalSessionFollowUpSetting, 'findOne').mockResolvedValue({ editWindowDays: 7, dashboardLookaheadDays: 1 } as any);
        jest.spyOn(ClinicalSessionFollowUpSetting, 'find').mockResolvedValue([{ departmentId: 10, editWindowDays: 3,
            dashboardLookaheadDays: 5, patientCaseManagerRoleCodes: ['THERAPIST'] }] as any);
        const service = new SettingService();
        jest.spyOn(service, 'getKey').mockResolvedValue(['SUPERVISOR'] as any);
        const result = await service.clinicalSettings([10, 20]);
        expect(result.editWindowDays).toBe(3);
        expect(result.dashboardLookaheadDays).toBe(5);
    });
    it('refuses global and external department edits for a project researcher', async () => {
        jest.spyOn(ClinicalAccess, 'viewer').mockResolvedValue({ id: 1, roles: [{ code: 'PROJECT_RESEARCHER' }], departments: [{ id: 10 }] } as User);
        jest.spyOn(ClinicalAccess, 'grants').mockResolvedValue(['clinical-settings.edit.department']);
        const service = Object.create(ClinicalSessionSchedulingService.prototype);
        await expect(service.assertClinicalSettingsDepartment(undefined, { id: 1 }, 'edit')).rejects.toThrow();
        await expect(service.assertClinicalSettingsDepartment(20, { id: 1 }, 'edit')).rejects.toThrow();
        await expect(service.assertClinicalSettingsDepartment(10, { id: 1 }, 'edit')).resolves.toBeUndefined();
    });
});
