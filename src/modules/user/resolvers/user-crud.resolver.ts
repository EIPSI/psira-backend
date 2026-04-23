import { UpdateManyResponse, Filter, SortDirection, mergeFilter } from '@nestjs-query/core';
import {
    CRUDResolver,
    FilterType,
    UpdateManyResponseType,
    QueryArgsType,
    ConnectionType,
} from '@nestjs-query/query-graphql';
import { UseGuards, ForbiddenException } from '@nestjs/common';
import {
    Resolver,
    Args,
    Mutation,
    ID,
    ResolveField,
    Parent,
    Query,
} from '@nestjs/graphql';
import { CurrentUser } from 'src/modules/auth/auth-user.decorator';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import { UsePermission } from 'src/modules/permission/decorators/permission.decorator';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { PermissionGuard } from 'src/modules/permission/guards/permission.guard';
import { CreateOneUserInput } from '../dto/create-one-user.input';
import { CreateUserInput } from '../dto/create-user.input';
import { UpdateOneUserInput } from '../dto/update-one-user.input';
import { UpdateUserInput } from '../dto/update-user.input';
import { User } from '../models/user.model';
import { UserCrudService } from '../providers/user-crud.service';
import { PermissionService } from '../../permission/providers/permission.service';
import { Permission } from 'src/modules/permission/models/permission.model';
import { DeleteOneUserInput } from '../dto/delete-one-user.input';
import { UserDepartmentAccessService, DepartmentAccessScope } from '../services/user-department-access.service';
import { In } from 'typeorm';
import { ArgsType } from '@nestjs/graphql';

@ArgsType()
class UserQuery extends QueryArgsType(User) {}

const UserConnection = UserQuery.ConnectionType;

@Resolver(() => User)
@UseGuards(GqlAuthGuard, PermissionGuard)
export class UserCrudResolver extends CRUDResolver(User, {
    CreateDTOClass: CreateUserInput,
    UpdateDTOClass: UpdateUserInput,
    read: {
        defaultSort: [{ field: 'id', direction: SortDirection.DESC }],
        decorators: [UsePermission(PermissionEnum.VIEW_USERS)],
    },
    create: { disabled: true },
    update: { disabled: true },
    delete: { disabled: true },
}) {
    constructor(
        readonly service: UserCrudService,
        private readonly permissionService: PermissionService,
        private readonly userDepartmentAccessService: UserDepartmentAccessService,
    ) {
        super(service);
    }

    @Query(() => UserConnection)
    @UsePermission(PermissionEnum.VIEW_USERS)
    async users(
        @Args({ type: () => UserQuery }) query: UserQuery,
        @CurrentUser() currentUser: User,
    ): Promise<ConnectionType<User>> {
        const access = await this.userDepartmentAccessService.getUserDepartmentAccess(currentUser.id);

        let departmentFilter: Filter<User> = {};
        if (access.scope !== DepartmentAccessScope.ALL) {
            departmentFilter = {
                departments: {
                    id: { in: access.departmentIds },
                },
            };
        }

        query.filter = mergeFilter(query.filter, departmentFilter);

        return UserConnection.createFromPromise(
            q => this.service.query(q),
            query,
            q => this.service.count(q),
        );
    }

    @Query(() => User)
    @UsePermission(PermissionEnum.VIEW_USERS)
    async user(
        @Args('id', { type: () => ID }) id: number,
        @CurrentUser() currentUser: User,
    ): Promise<User> {
        const access = await this.userDepartmentAccessService.getUserDepartmentAccess(currentUser.id);

        if (access.scope !== DepartmentAccessScope.ALL) {
            const userWithDepts = await User.findOne({
                where: { id: Number(id) },
                relations: ['departments'],
            });

            if (userWithDepts) {
                const inSameDept = userWithDepts.departments.some(d => access.departmentIds.includes(d.id));
                if (!inSameDept) {
                    throw new ForbiddenException('No tienes permiso para ver este usuario');
                }
            }
        }

        const [user] = await this.service.query({ filter: { id: { eq: Number(id) } } });
        return user;
    }

    @Mutation(() => User)
    @UsePermission(PermissionEnum.MANAGE_USERS)
    async createOneUser(
        @Args('input', { type: () => CreateOneUserInput })
        input: CreateOneUserInput,
        @CurrentUser() currentUser: User,
    ): Promise<User> {
        // Validar departamentos si se proporcionan
        const userInput = input['user'] as any;
        if (userInput.departmentIds && userInput.departmentIds.length > 0) {
            const canAccess = await this.userDepartmentAccessService.canAccessDepartments(
                currentUser.id,
                userInput.departmentIds,
            );

            if (!canAccess) {
                throw new ForbiddenException(
                    'No puedes crear usuarios en departamentos a los que no perteneces',
                );
            }
        }

        // delegate to service
        return this.service.createOne(input['user']);
    }

    @Mutation(() => User)
    @UsePermission(PermissionEnum.MANAGE_USERS)
    async updateOneUser(
        @Args('input', { type: () => UpdateOneUserInput })
        input: UpdateOneUserInput,
        @CurrentUser() currentUser: User,
    ): Promise<User> {
        const { id, update } = input;

        // Validar departamentos si se están actualizando
        const userInputUpdate = update as any;
        if (userInputUpdate.departmentIds && userInputUpdate.departmentIds.length > 0) {
            const canAccess = await this.userDepartmentAccessService.canAccessDepartments(
                currentUser.id,
                userInputUpdate.departmentIds,
            );

            if (!canAccess) {
                throw new ForbiddenException(
                    'No puedes asignar usuarios a departamentos a los que no perteneces',
                );
            }
        }

        // Validar jerarquía de roles
        const [user] = await this.service.query({
            filter: { id: { eq: Number(id) } },
        });

        if (user && userInputUpdate.roleCodes) {
            const targetRoleHierarchy = await this.userDepartmentAccessService.getRoleHierarchy(userInputUpdate.roleCodes);
            
            // Get current user's roles for hierarchy check
            const currentUserWithRoles = await User.findOne({
                where: { id: currentUser.id },
                relations: ['roles'],
            });
            const userRoleHierarchy = this.getMaxRoleHierarchy(currentUserWithRoles.roles);

            if (targetRoleHierarchy > userRoleHierarchy) {
                throw new ForbiddenException(
                    'No puedes asignar roles de mayor jerarquía que los tuyos',
                );
            }
        }

        // delegate to service
        return this.service.updateOneUser(Number(id), update, currentUser);
    }

    @Mutation(() => Boolean)
    @UsePermission(PermissionEnum.MANAGE_USERS)
    async deleteOneUser(
        @Args('input', { type: () => DeleteOneUserInput })
        input: DeleteOneUserInput,
        @CurrentUser() currentUser: User,
    ): Promise<boolean> {
        const { id } = input;

        // Validar que el usuario a eliminar pertenezca a departamentos del creador
        const [userToDelete] = await this.service.query({
            filter: { id: { eq: Number(id) } },
        });
        
        // We need departments to check
        const userToDeleteWithDepts = await User.findOne({
            where: { id: Number(id) },
            relations: ['departments'],
        });

        if (userToDeleteWithDepts && userToDeleteWithDepts.departments && userToDeleteWithDepts.departments.length > 0) {
            const creatorDeptIds = await this.userDepartmentAccessService.getUserDepartmentIds(currentUser.id);

            const userInSameDept = userToDeleteWithDepts.departments.some(d => 
                creatorDeptIds.includes(d.id)
            );

            const isSuperAdmin = await this.permissionService.userCan(currentUser.id, PermissionEnum.VIEW_ALL_USERS);

            if (!userInSameDept && !isSuperAdmin) {
                throw new ForbiddenException(
                    'Solo puedes eliminar usuarios que pertenezcan a tus departamentos',
                );
            }
        }

        // delegate to service
        return this.service.deleteOneUser(Number(id), currentUser);
    }

    @Mutation(() => User)
    @UsePermission(PermissionEnum.MANAGE_USERS)
    async restoreOneUser(
        @Args('input', { type: () => ID }) id: number,
        @CurrentUser() currentUser: User,
    ): Promise<User> {
        // Validar que el usuario a restaurar pertenezca a departamentos del creador
        const userToRestore = await User.findOne({
            where: { id: Number(id) },
            relations: ['departments'],
            withDeleted: true,
        });

        if (userToRestore && userToRestore.departments && userToRestore.departments.length > 0) {
            const creatorDeptIds = await this.userDepartmentAccessService.getUserDepartmentIds(currentUser.id);

            const userInSameDept = userToRestore.departments.some(d => 
                creatorDeptIds.includes(d.id)
            );

            const isSuperAdmin = await this.permissionService.userCan(currentUser.id, PermissionEnum.VIEW_ALL_USERS);

            if (!userInSameDept && !isSuperAdmin) {
                throw new ForbiddenException(
                    'Solo puedes restaurar usuarios que pertenezcan a tus departamentos',
                );
            }
        }

        // delegate to service
        return this.service.restoreOne(id);
    }

    @Mutation(() => UpdateManyResponseType())
    @UsePermission(PermissionEnum.MANAGE_USERS)
    async restoreManyUsers(
        @Args('input', { type: () => FilterType(User) }) filter: Filter<User>,
        @CurrentUser() currentUser: User,
    ): Promise<UpdateManyResponse> {
        // Get creator's departments
        const creatorDeptIds = await this.userDepartmentAccessService.getUserDepartmentIds(currentUser.id);

        // Apply department filter to the restore operation
        const access = await this.userDepartmentAccessService.getUserDepartmentAccess(currentUser.id);

        if (access.scope === DepartmentAccessScope.ALL) {
            // SuperAdmin can restore all
            return this.service.restoreMany(filter);
        }

        // Filter users to restore: only those in creator's departments
        const deptFilter: Filter<User> = {
            and: [
                { deletedAt: { isNot: null } }, // Only restore deleted users
                {
                    departments: {
                        id: { in: creatorDeptIds },
                    },
                },
            ],
        };

        const combinedFilter = filter ? mergeFilter(filter, deptFilter) : deptFilter;

        return this.service.restoreMany(combinedFilter);
    }

    @Mutation(() => User)
    async updateUserAcceptedTerm(
        @Args('input', { type: () => UpdateOneUserInput })
        input: UpdateOneUserInput,
    ): Promise<User> {
        const { id, update } = input;

        // Delegate further actions to service
        return this.service.updateUserAcceptedTerm(Number(id), update);
    }

    @ResolveField(() => Boolean)
    passwordChangeRequired(@Parent() user: User) {
        return this.service.passwordChangeRequired(user);
    }

    // permission grants
    @ResolveField(() => [Permission], {
        description: 'Get User Permission Grants. ',
    })
    @UseGuards(GqlAuthGuard)
    permissionGrants(@Parent() user: User): Promise<Permission[]> {
        return PermissionService.userPermissionGrants(user.id);
    }

    /**
     * Get max role hierarchy from a user's roles
     */
    private getMaxRoleHierarchy(roles: any[]): number {
        if (!roles || roles.length === 0) {
            return 0;
        }
        return Math.max(...roles.map(r => r.hierarchy));
    }
}
