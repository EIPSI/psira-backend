jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
import { researchRoleDefaults, researchPermissionNames } from '../research-role-policy';
import { RoleCode } from '../enums/role-code.enum';
import { assertAdministrativeMutation } from 'src/shared/administrative-access';
import { assertProjectResourceDepartments } from 'src/shared/project-resource-access';
import { UserCrudService } from 'src/modules/user/providers/user-crud.service';
import { Department } from 'src/modules/department/models/department.model';
import { User } from 'src/modules/user/models/user.model';
import { Role } from '../models/role.model';
import { PermissionService } from './permission.service';

describe('Research role defaults', () => {
    it('keeps the hierarchy between superadmin and department administration', () => {
        expect(researchRoleDefaults.map(role => role.hierarchy)).toEqual([100, 200]);
    });
    it('gives research administrators global research access without system security settings', () => {
        const permissions = researchPermissionNames(RoleCode.RESEARCH_ADMIN);
        expect(permissions).toEqual(expect.arrayContaining(['users.edit.all', 'clinical.edit.all', 'roles.edit.all',
            'automations.edit.all', 'clinical-settings.edit.all', 'data-exports.view.all', 'departments.create.all']));
        expect(permissions.some(name => name.startsWith('system.'))).toBe(false);
    });
    it('gives project researchers the same capabilities with departmental scopes', () => {
        const permissions = researchPermissionNames(RoleCode.PROJECT_RESEARCHER);
        expect(permissions).toEqual(expect.arrayContaining(['users.create.department', 'clinical.edit.department',
            'questionnaires.edit.department', 'automations.edit.department', 'clinical-settings.edit.department', 'data-exports.view.department']));
        expect(permissions.some(name => name.endsWith('.all'))).toBe(false);
        expect(permissions).toEqual(expect.arrayContaining(['roles.edit.department-hierarchy',
            'permissions.assign.department-hierarchy', 'departments.create.department', 'departments.delete.department',
            'settings.view.department', 'settings.edit.department']));
        const equivalent = researchPermissionNames(RoleCode.RESEARCH_ADMIN).map(name => name.replace(/\.all$/,
            /^(roles|permissions)\./.test(name) ? '.department-hierarchy' : '.department'));
        expect([...permissions].sort()).toEqual(equivalent.sort());
    });
});

describe('Administrative delegation', () => {
    afterEach(() => jest.restoreAllMocks());
    function fixture(project = false, targetExtra = {}) {
        const viewer = { id: 1, roles: [{ code: project ? RoleCode.PROJECT_RESEARCHER : RoleCode.RESEARCH_ADMIN,
            hierarchy: project ? 200 : 100 }], departments: [{ id: 10 }] };
        const target = { id: 2, roles: [{ code: RoleCode.THERAPIST, hierarchy: 500, permissions: [] }], permissions: [],
            departments: [{ id: 10 }], ...targetExtra };
        jest.spyOn(User, 'findOneOrFail').mockImplementation(async id => (id === 1 ? viewer : target) as User);
        jest.spyOn(PermissionService, 'userPermissionGrants').mockResolvedValue(researchPermissionNames(
            project ? RoleCode.PROJECT_RESEARCHER : RoleCode.RESEARCH_ADMIN,
        ).map(name => ({ name })) as any);
        return { viewer, target };
    }
    it('cannot modify a superadmin even with users.edit.all', async () => {
        fixture(false, { isSuperUser: true });
        await expect(assertAdministrativeMutation(1, 'updateOneUser', { id: 2, update: { firstName: 'Changed' } })).rejects.toThrow();
    });
    it('cannot grant superadmin through an automatically generated relation mutation', async () => {
        fixture();
        jest.spyOn(Role, 'find').mockResolvedValue([{ id: 3, code: RoleCode.SUPER_ADMIN, hierarchy: 1 }] as Role[]);
        await expect(assertAdministrativeMutation(1, 'addRolesToUser', { id: 2, relationIds: [3] })).rejects.toThrow('strictly below');
    });
    it('cannot hide a forbidden role inside a multi-role creation request', async () => {
        fixture();
        jest.spyOn(Role, 'find').mockResolvedValue([{ code: RoleCode.PATIENT, hierarchy: 900 },
            { code: RoleCode.SUPER_ADMIN, hierarchy: 1 }] as Role[]);
        await expect(assertAdministrativeMutation(1, 'createOneUser', { user: { roleCodes: ['PATIENT', 'SUPER_ADMIN'],
            departmentIds: [10] } })).rejects.toThrow();
    });
    it('cannot remove another department from a shared account', async () => {
        fixture(true, { departments: [{ id: 10 }, { id: 20 }] });
        await expect(assertAdministrativeMutation(1, 'updateOneUser', { id: 2, update: { departmentIds: [10] } })).rejects.toThrow('remove another');
        await expect(assertAdministrativeMutation(1, 'removeDepartmentsFromUser', { id: 2, relationIds: [20] })).rejects.toThrow('membership');
    });
    it('allows personal edits that preserve the shared account’s roles and departments', async () => {
        fixture(true, { departments: [{ id: 10 }, { id: 20 }] });
        await expect(assertAdministrativeMutation(1, 'updateOneUser', { id: 2, update: { firstName: 'Updated',
            roleCodes: ['THERAPIST'], departmentIds: [10, 20] } })).resolves.toBeUndefined();
    });
    it('does not modify technical accounts protected by direct permissions', async () => {
        fixture(false, { permissions: [{ name: 'system.edit.all' }] });
        await expect(assertAdministrativeMutation(1, 'updateOneUser', { id: 2, update: {} })).rejects.toThrow('additional privileges');
    });
});

describe('Shared research resources', () => {
    it('allows reading global instruments, but not changing their definitions', () => {
        expect(() => assertProjectResourceDepartments([10], { departmentIds: [] }, false)).not.toThrow();
        expect(() => assertProjectResourceDepartments([10], { departmentIds: [] }, true)).toThrow();
    });
    it('cannot change a shared instrument that also belongs to another department', () => {
        expect(() => assertProjectResourceDepartments([10], { departmentIds: [10, 20] }, true)).toThrow();
        expect(() => assertProjectResourceDepartments([10], { departmentIds: [10] }, true)).not.toThrow();
    });
    it('cannot configure a departmental consent to apply everywhere', () => {
        expect(() => assertProjectResourceDepartments([10], { departmentIds: [10], appliesToAllDepartments: true }, true)).toThrow();
    });
});


describe('Project account default departments', () => {
    afterEach(() => jest.restoreAllMocks());
    it('does not silently add external default departments when creating a project account', async () => {
        jest.spyOn(Department, 'find').mockResolvedValue([
            { id: 10, defaultRoleCodes: [RoleCode.THERAPIST] },
            { id: 20, defaultRoleCodes: [RoleCode.THERAPIST] },
        ] as Department[]);
        const service = Object.create(UserCrudService.prototype) as any;
        expect(await service.applyDefaultDepartmentsForRoles([RoleCode.THERAPIST], [], [10])).toEqual([10]);
        expect(await service.applyDefaultDepartmentsForRoles([RoleCode.THERAPIST], [20], [10])).toEqual([20, 10]);
        expect(await service.applyDefaultDepartmentsForRoles([RoleCode.THERAPIST], [], [])).toEqual([]);
    });
});
