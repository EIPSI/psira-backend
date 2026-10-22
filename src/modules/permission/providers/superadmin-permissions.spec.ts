jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
import { PermissionService } from './permission.service';
import { User } from '../../user/models/user.model';
import { Permission } from '../models/permission.model';
import { Role } from '../models/role.model';
import { RoleCode } from '../enums/role-code.enum';

describe('Superadmin permissions', () => {
    afterEach(() => jest.restoreAllMocks());
    it.each([
        { isSuperUser: true, roles: [] },
        { isSuperUser: false, roles: [{ code: RoleCode.SUPER_ADMIN }] },
    ])('grants every current permission even if role grants are incomplete: %j', async user => {
        const all = [{ name: 'patients.edit.all' }, { name: 'clinical.edit.department' }] as Permission[];
        jest.spyOn(User, 'findOne').mockResolvedValue({ ...user, permissions: [] } as User);
        jest.spyOn(Permission, 'find').mockResolvedValue(all);
        expect(await PermissionService.userPermissionGrants(1)).toEqual(all);
    });
    it('preserves the permission scope of ordinary users', async () => {
        const own = { name: 'patients.edit.assigned' } as Permission;
        jest.spyOn(User, 'findOne').mockResolvedValue({ permissions: [own], roles: [{ id: 2 }] } as User);
        jest.spyOn(Role, 'find').mockResolvedValue([{ permissions: [] }] as Role[]);
        const all = jest.spyOn(Permission, 'find');
        expect(await PermissionService.userPermissionGrants(2)).toEqual([own]);
        expect(all).not.toHaveBeenCalled();
    });
});
