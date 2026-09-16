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

@Resolver(() => Department)
@UseGuards(GqlAuthGuard, PermissionGuard)
@UseOrPermissions([PermissionEnum.PATIENTS_VIEW_DEPARTMENT, PermissionEnum.PATIENTS_EDIT_DEPARTMENT])
export class DepartmentResolver {

    constructor(
        @InjectQueryService(Department) readonly service: QueryService<Department>
    ) { }

    @Mutation(() => Department)
    @UsePermission(PermissionEnum.SETTINGS_EDIT_ALL)
    async createOneDepartment(@Args('input', { type: () => CreateOneDepartmentInput }) input: CreateOneDepartmentInput): Promise<Department> {

        const department = this.normalizeDepartmentInput(this.extractDepartmentInput(input));

        // delegate further actions to service
        return this.service.createOne(department);
    }

    @Mutation(() => [Department])
    @UsePermission(PermissionEnum.PATIENTS_EDIT_DEPARTMENT)
    async createManyDepartments(@Args('input', { type: () => CreateManyDepartmentsInput }) input: CreateManyDepartmentsInput): Promise<Department[]> {

        const departments = (input['departments'] || []).map(department => this.normalizeDepartmentInput(department));

        // delegate further actions to service
        return this.service.createMany(departments);
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
