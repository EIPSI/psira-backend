import { Role } from 'src/modules/permission/models/role.model';
import { Department } from 'src/modules/department/models/department.model';
import { RoleCrudService } from 'src/modules/permission/providers/role-crud.service';
jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
import * as typeorm from 'typeorm';
import { GraphQLInt, GraphQLObjectType, GraphQLBoolean } from 'graphql';
import { User } from 'src/modules/user/models/user.model';
import { RoleCode } from 'src/modules/permission/enums/role-code.enum';
import { projectDepartments, assertProjectResourceRequest } from './project-resource-access';
import { departmentDefinitionFilter } from './department-definition-access';
import { Disclaimer } from 'src/modules/disclaimer/models/disclaimer.model';
import { DisclaimerService } from 'src/modules/disclaimer/providers/disclaimer.service';
import { DisclaimerResolver } from 'src/modules/disclaimer/resolvers/disclaimer.resolver';
import { PermissionService } from 'src/modules/permission/providers/permission.service';

const info = (fieldName: string, model: string) => ({ fieldName, operation: { operation: 'mutation' },
    returnType: model === 'Boolean' ? GraphQLBoolean : new GraphQLObjectType({ name: model, fields: { id: { type: GraphQLInt } } }),
});

describe('Research project configuration boundaries', () => {
    beforeEach(() => {
        jest.spyOn(User, 'findOneOrFail').mockResolvedValue({ id: 1, roles: [{ code: RoleCode.PROJECT_RESEARCHER }],
            departments: [{ id: 10 }] } as User);
    });
    afterEach(() => jest.restoreAllMocks());

    it('keeps delegated custom roles constrained even without the project-researcher code', async () => {
        (User.findOneOrFail as jest.Mock).mockResolvedValue({ id: 1, roles: [{ code: 'CUSTOM_ABC', departmentIds: [10] }],
            departments: [{ id: 10 }] });
        expect(await projectDepartments(1)).toEqual([10]);
    });
    it('creates local role definitions inside the caller departments', async () => {
        const args = { input: { role: { name: 'Project assessor', hierarchy: 600 } } };
        await assertProjectResourceRequest(1, info('createOneRole', 'Role'), args);
        expect((args.input.role as any).departmentIds).toEqual([10]);
    });
    it.each([{ departments: [20] }, { departments: [] }])('cannot modify external or system role definitions (%j)', async ({ departments }) => {
        jest.spyOn(typeorm, 'getRepository').mockReturnValue({ metadata: { relations: [] },
            findOne: jest.fn().mockResolvedValue({ id: 2, departmentIds: departments }) } as any);
        await expect(assertProjectResourceRequest(1, info('addPermissionsToRole', 'Role'),
            { input: { id: 2, relationIds: [3] } })).rejects.toThrow('global administrator');
    });
    it('can edit a departmental catalog but cannot move its entry to an external department', async () => {
        jest.spyOn(typeorm, 'getRepository').mockReturnValue({ metadata: { relations: [] },
            findOne: jest.fn().mockResolvedValue({ id: 2, departmentIds: [10] }) } as any);
        await expect(assertProjectResourceRequest(1, info('updateOnePatientStatus', 'PatientStatus'),
            { input: { id: 2, update: { name: 'Paused' } } })).resolves.toBeUndefined();
        await expect(assertProjectResourceRequest(1, info('updateOnePatientStatus', 'PatientStatus'),
            { input: { id: 2, update: { departmentIds: [20] } } })).rejects.toThrow();
    });
    it('does not allow bulk mutations to bypass individual ownership validation', async () => {
        await expect(assertProjectResourceRequest(1, info('deleteManyPatientStatuses', 'Boolean'),
            { input: { filter: {} } })).rejects.toThrow('individually');
    });
    it('filters local catalogs before pagination while preserving shared defaults', async () => {
        jest.spyOn(typeorm, 'getRepository').mockReturnValue({ find: jest.fn().mockResolvedValue([
            { id: 1, departmentIds: null }, { id: 2, departmentIds: [10] }, { id: 3, departmentIds: [20] },
        ]) } as any);
        expect(await departmentDefinitionFilter('Role', { req: { user: { id: 1 } } })).toEqual({ id: { in: [1, 2] } });
    });
    it('makes a newly created departmental role assignable without changing another department', async () => {
        const department = { id: 10, appliedRoleCodes: ['THERAPIST'] };
        const roleRepository = { create: jest.fn(input => input), save: jest.fn(async input => ({ id: 7, ...input })) };
        const departmentRepository = { find: jest.fn().mockResolvedValue([department]), save: jest.fn() };
        const manager = { getRepository: model => model === Role ? roleRepository : departmentRepository };
        jest.spyOn(Role, 'getRepository').mockReturnValue({ manager: { transaction: callback => callback(manager) } } as any);
        const service = Object.create(RoleCrudService.prototype) as RoleCrudService;
        const role = await service.createOne({ name: 'Project assessor', hierarchy: 600, departmentIds: [10] });
        expect(role.code).toMatch(/^CUSTOM_[A-F0-9]+$/);
        expect(department.appliedRoleCodes).toEqual(['THERAPIST', role.code]);
        expect(departmentRepository.find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.any(Object) }));
        expect(departmentRepository.save).toHaveBeenCalledTimes(1);
        expect(manager.getRepository(Department)).toBe(departmentRepository);
    });
    it('stores a department message without overwriting the shared message', async () => {
        const shared = { type: 'versionMessage', description: 'Global', save: jest.fn() };
        jest.spyOn(Disclaimer, 'findOne').mockResolvedValue(shared as any);
        const query = jest.fn().mockResolvedValue([{ type: 'versionMessage', description: 'Project' }]);
        jest.spyOn(Disclaimer, 'getRepository').mockReturnValue({ query } as any);
        expect(await new DisclaimerService().updateDisclaimer({ type: 'versionMessage', description: 'Project', departmentId: 10 }))
            .toMatchObject({ description: 'Project' });
        expect(query.mock.calls[0][1]).toEqual([10, 'versionMessage', 'Project']);
        expect(shared.save).not.toHaveBeenCalled();
    });
    it('cannot write global messages or messages for other departments', async () => {
        jest.spyOn(PermissionService, 'userCan').mockResolvedValue(false);
        const resolver = new DisclaimerResolver({ updateDisclaimer: jest.fn() } as any);
        for (const departmentId of [undefined, 20]) {
            await expect(resolver.updateDisclaimer({ type: 'versionMessage', description: 'Changed', departmentId }, { id: 1 } as User))
                .rejects.toThrow('outside your scope');
        }
    });
});
