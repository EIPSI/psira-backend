import { projectDepartments } from 'src/shared/project-resource-access';
import { CurrentUser } from 'src/modules/auth/auth-user.decorator';
import { User } from 'src/modules/user/models/user.model';
import { PermissionService } from 'src/modules/permission/providers/permission.service';
import { UpdateOneInputType, DeleteOneInputType } from '@nestjs-query/query-graphql';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, InputType, Mutation, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import { PermissionGuard } from 'src/modules/permission/guards/permission.guard';
import { QueryService, InjectQueryService } from '@nestjs-query/core';
import { CreateOneInputType, CreateManyInputType } from '@nestjs-query/query-graphql';
import { UseOrPermissions, UsePermission } from 'src/modules/permission/decorators/permission.decorator';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { DepartmentInput } from '../dtos/department.input';
import { Department } from '../models/department.model';


@InputType()
export class CreateOneDepartmentInput extends CreateOneInputType('department', DepartmentInput) { }

@InputType()
export class CreateManyDepartmentsInput extends CreateManyInputType('departments', DepartmentInput) { }

@InputType()
export class UpdateOneDepartmentInput extends UpdateOneInputType(Department, DepartmentInput) {}
@InputType()
export class DeleteOneDepartmentInput extends DeleteOneInputType(Department) {}

@Resolver(() => Department)
@UseGuards(GqlAuthGuard, PermissionGuard)
@UseOrPermissions([PermissionEnum.PATIENTS_VIEW_DEPARTMENT, PermissionEnum.PATIENTS_EDIT_DEPARTMENT])
export class DepartmentResolver {

    constructor(
        @InjectQueryService(Department) readonly service: QueryService<Department>
    ) { }

    @Mutation(() => Department)
    @UseOrPermissions([PermissionEnum.DEPARTMENTS_CREATE_ALL, PermissionEnum.DEPARTMENTS_CREATE_DEPARTMENT, PermissionEnum.SETTINGS_EDIT_ALL])
    async createOneDepartment(@Args('input', { type: () => CreateOneDepartmentInput }) input: CreateOneDepartmentInput, @CurrentUser() user: User): Promise<Department> {

        const department = this.normalizeDepartmentInput(this.extractDepartmentInput(input));

        // delegate further actions to service
        const owned = await projectDepartments(user.id);
        if (!owned) return this.service.createOne(department);
        return Department.getRepository().manager.transaction(async manager => {
            const created = await manager.getRepository(Department).save(manager.getRepository(Department).create(department));
            await manager.createQueryBuilder().relation(User, 'departments').of(user.id).add(created.id);
            return created;
        });
    }

    @Mutation(() => [Department])
    @UsePermission(PermissionEnum.DEPARTMENTS_CREATE_ALL)
    async createManyDepartments(@Args('input', { type: () => CreateManyDepartmentsInput }) input: CreateManyDepartmentsInput): Promise<Department[]> {

        const departments = (input['departments'] || []).map(department => this.normalizeDepartmentInput(department));

        // delegate further actions to service
        return this.service.createMany(departments);
    }

    @Mutation(() => Department)
    @UseOrPermissions([PermissionEnum.DEPARTMENTS_EDIT_ALL, PermissionEnum.DEPARTMENTS_EDIT_DEPARTMENT, PermissionEnum.SETTINGS_EDIT_ALL])
    async updateOneDepartment(@Args('input') input: UpdateOneDepartmentInput, @CurrentUser() user: User): Promise<Department> {
        const current = await Department.findOneOrFail(Number(input.id));
        const global = await PermissionService.userCan(user.id, PermissionEnum.DEPARTMENTS_EDIT_ALL) ||
            await PermissionService.userCan(user.id, PermissionEnum.SETTINGS_EDIT_ALL);
        if (!global) {
            const viewer = await User.findOneOrFail(user.id, { relations: ['departments'] });
            if (!viewer.departments.some(department => department.id === current.id)) throw new BadRequestException('Department outside your scope');

        }
        return this.service.updateOne(input.id, this.normalizeDepartmentInput({ ...current, ...input.update }));
    }

    @Mutation(() => Department)
    @UseOrPermissions([PermissionEnum.DEPARTMENTS_DELETE_ALL, PermissionEnum.DEPARTMENTS_DELETE_DEPARTMENT, PermissionEnum.SETTINGS_EDIT_ALL])
    async deleteOneDepartment(@Args('input') input: DeleteOneDepartmentInput, @CurrentUser() user: User): Promise<Department> {
        const owned = await projectDepartments(user.id);
        if (owned && !owned.includes(Number(input.id))) throw new BadRequestException('Department outside your scope');
        return this.service.deleteOne(input.id);
    }

    private extractDepartmentInput(input: CreateOneDepartmentInput | any): DepartmentInput {
        return input?.department || input?.input?.department || input?.input || input;
    }

    private normalizeDepartmentInput(department: DepartmentInput): DepartmentInput {
        const name = department?.name?.trim();
        if (!name) {
            throw new BadRequestException('Department name is required');
        }

        const defaultRoleCodes = department.defaultRoleCodes || [];
        const appliedRoleCodes = department.appliedRoleCodes?.length
            ? department.appliedRoleCodes
            : defaultRoleCodes;

        return {
            ...department,
            name,
            description: department.description?.trim() || '',
            active: department.active !== false,
            appliedRoleCodes,
            defaultRoleCodes,
        };
    }

}
