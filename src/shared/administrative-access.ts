import { ForbiddenException } from '@nestjs/common';
import { In } from 'typeorm';
import { User } from 'src/modules/user/models/user.model';
import { Role } from 'src/modules/permission/models/role.model';
import { Permission } from 'src/modules/permission/models/permission.model';
import { PermissionService } from 'src/modules/permission/providers/permission.service';

export function isSuperAdministrator(user: User): boolean {
    return !!user.isSuperUser || user.roles?.some(role => role.code === 'SUPER_ADMIN');
}
export const strongestRole = (user: User): number => Math.min(...(user.roles || []).map(role => role.hierarchy), 999);

export async function assertAdministrativeMutation(userId: number, operation: string, input: any): Promise<void> {
    const userMutation = /^(createOneUser|updateOneUser|deleteOneUser|restoreOneUser|addRolesToUser|setRolesOnUser|removeRolesFromUser|addDepartmentsToUser|setDepartmentsOnUser|removeDepartmentsFromUser)$/.test(operation);
    if (!userMutation) return;
    const viewer = await User.findOneOrFail(userId, { relations: ['roles', 'departments'] });
    if (isSuperAdministrator(viewer)) return;
    const values = input?.update || input?.user || input || {};
    const id = Number(input?.id || (typeof input === 'string' || typeof input === 'number' ? input : 0));
    const target = id ? await User.findOneOrFail(id, { relations: ['roles', 'roles.permissions', 'permissions', 'departments'], withDeleted: true }) : undefined;
    if (target && (target.isSuperUser || strongestRole(target) <= strongestRole(viewer))) {
        throw new ForbiddenException('Only a higher administrator can modify this account');
    }
    const grants = (await PermissionService.userPermissionGrants(userId)).map(item => item.name);
    const action = operation === 'createOneUser' ? 'create' : operation === 'deleteOneUser' ? 'delete'
        : operation === 'restoreOneUser' ? 'restore' : 'edit';
    const global = grants.includes(`users.${action}.all`);
    if (!global && !grants.some(name => [`users.${action}.department`, `users.${action}.department-hierarchy`].includes(name))) {
        throw new ForbiddenException('User administration permission required');
    }
    const ownDepartments = viewer.departments.map(department => department.id);
    const targetDepartments = target?.departments.map(department => department.id) || [];
    if (target && !global && !targetDepartments.some(id => ownDepartments.includes(id))) throw new ForbiddenException('Account belongs to another department');
    const roleMutation = /Roles.*User$/.test(operation);
    const departmentMutation = /Departments.*User$/.test(operation);
    const roleCodesChanged = values.roleCodes !== undefined && (!target ||
        JSON.stringify([...values.roleCodes].sort()) !== JSON.stringify(target.roles.map(role => role.code).sort()));
    const delegateGrants = grants.map(name => ({ name } as Permission));
    const targetPermissions = [...(target?.permissions || []), ...(target?.roles || []).flatMap(role => role.permissions || [])];
    if (targetPermissions.some(permission => !PermissionService.hasPermission(delegateGrants, permission.name.replace(/\.assigned$/, '.department')))) {
        throw new ForbiddenException('A higher administrator must modify accounts with additional privileges');
    }
    if (roleCodesChanged || roleMutation) {
        if (!global && targetDepartments.some(id => !ownDepartments.includes(id))) {
            throw new ForbiddenException('A global administrator must change the roles of a shared account');
        }
        const roles = roleMutation
            ? await Role.find({ where: { id: In(input.relationIds?.length ? input.relationIds : [0]) } })
            : await Role.find({ where: { code: In(values.roleCodes?.length ? values.roleCodes : ['__NONE__']) } });
        const prospectiveDepartments = values.departmentIds || targetDepartments;
        if (!operation.startsWith('remove') && roles.some(role => role.departmentIds?.length &&
            prospectiveDepartments.some(departmentId => !role.departmentIds.includes(Number(departmentId))))) {
            throw new ForbiddenException('A departmental role cannot grant access to external account departments');
        }
        const requested = roleMutation ? input.relationIds || [] : values.roleCodes || [];
        if (roles.length !== new Set(requested).size || roles.some(role => role.code === 'SUPER_ADMIN' || role.hierarchy <= strongestRole(viewer))) {
            throw new ForbiddenException('You can only assign roles strictly below your own hierarchy');
        }
        const rolePermissions = roles.length ? await Role.find({ where: { id: In(roles.map(role => role.id)) }, relations: ['permissions'] }) : [];
        if (!operation.startsWith('remove') && rolePermissions.some(role => role.permissions.some(permission => !PermissionService.hasPermission(
            grants.map(name => ({ name } as Permission)), permission.name.replace(/\.assigned$/, '.department'),
        )))) throw new ForbiddenException('You cannot delegate permissions that you do not hold');
    }
    if (values.departmentIds && target?.roles.some(role => role.departmentIds?.length &&
        values.departmentIds.some(departmentId => !role.departmentIds.includes(Number(departmentId))))) {
        throw new ForbiddenException('Account departments exceed the scope of its departmental roles');
    }
    if (departmentMutation && !operation.startsWith('remove') && target?.roles.some(role => role.departmentIds?.length &&
        input.relationIds.some(departmentId => !role.departmentIds.includes(Number(departmentId))))) {
        throw new ForbiddenException('Account departments exceed the scope of its departmental roles');
    }
    if (!global) {
        const requested = departmentMutation ? (input.relationIds || []).map(Number) : values.departmentIds;
        if (requested?.some(id => !ownDepartments.includes(Number(id)))) {
            // Replacing membership may preserve departments managed by other administrators.
            if (departmentMutation || requested.some(id => !ownDepartments.includes(Number(id)) && !targetDepartments.includes(Number(id)))) {
                throw new ForbiddenException('Cannot change another department membership');
            }
        }
        if (values.departmentIds && targetDepartments.some(id => !ownDepartments.includes(id) && !values.departmentIds.includes(id))) {
            throw new ForbiddenException('Cannot remove another department membership');
        }
    }
}
