jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
import { Test } from '@nestjs/testing';
import { NestjsQueryGraphQLModule } from '@nestjs-query/query-graphql';
import { AssessmentModule } from 'src/modules/assessment/assessment.module';
import { PermissionModule } from 'src/modules/permission/permission.module';
import { UserModule } from 'src/modules/user/user.module';
import { DepartmentModule } from 'src/modules/department/department.module';
import { PatientModule } from 'src/modules/patient/patient.module';
import { User } from 'src/modules/user/models/user.model';
import * as typeorm from 'typeorm';

function authorizerProviders(): any[] {
    const providers = new Map();
    for (const feature of [AssessmentModule, PermissionModule, UserModule, DepartmentModule, PatientModule]) {
        for (const imported of Reflect.getMetadata('imports', feature) || []) {
            if (imported?.module !== NestjsQueryGraphQLModule) continue;
            for (const provider of imported.providers || []) {
                if (typeof provider.provide === 'string' && provider.provide.endsWith('Authorizer')) providers.set(provider.provide, provider);
            }
        }
    }
    return [...providers.values()];
}

describe('Authorizer dependency registration', () => {
    afterEach(() => jest.restoreAllMocks());
    it('constructs the real authorization providers including relations to custom resolvers', async () => {
        const module = await Test.createTestingModule({ providers: authorizerProviders() }).compile();
        try {
            for (const token of ['AssessmentTypeAuthorizer', 'RoleAuthorizer', 'UserAuthorizer', 'AssessmentAuthorizer', 'PatientStatusAuthorizer']) {
                expect(typeof module.get(token).authorize).toBe('function');
            }
        } finally { await module.close(); }
    });
    it('retains department filtering instead of substituting an empty authorizer', async () => {
        jest.spyOn(User, 'findOneOrFail').mockResolvedValue({ roles: [{ code: 'PROJECT_RESEARCHER' }], departments: [{ id: 10 }] } as User);
        jest.spyOn(typeorm, 'getRepository').mockReturnValue({ find: jest.fn().mockResolvedValue([
            { id: 1, departmentIds: null }, { id: 2, departmentIds: [10] }, { id: 3, departmentIds: [20] },
        ]) } as any);
        const module = await Test.createTestingModule({ providers: authorizerProviders() }).compile();
        try {
            expect(await module.get('RoleAuthorizer').authorize({ req: { user: { id: 1 } } })).toEqual({ id: { in: [1, 2] } });
        } finally { await module.close(); }
    });
});
