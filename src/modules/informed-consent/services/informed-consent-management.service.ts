import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Department } from 'src/modules/department/models/department.model';
import { Role } from 'src/modules/permission/models/role.model';
import { User } from 'src/modules/user/models/user.model';
import { Repository } from 'typeorm';
import {
    CreateInformedConsentManagementInput,
    UpdateInformedConsentManagementInput,
} from '../dtos/informed-consent-management.input';
import { InformedConsentManagementStatus } from '../enums/informed-consent-management-status.enum';
import { InformedConsentManagement } from '../models/informed-consent-management.model';
import { InformedConsentModel } from '../models/informed-consent-model.model';

@Injectable()
export class InformedConsentManagementService {
    constructor(
        @InjectRepository(InformedConsentManagement)
        private readonly managementRepository: Repository<InformedConsentManagement>,
        @InjectRepository(InformedConsentModel)
        private readonly modelRepository: Repository<InformedConsentModel>,
        @InjectRepository(Department)
        private readonly departmentRepository: Repository<Department>,
        @InjectRepository(Role)
        private readonly roleRepository: Repository<Role>,
    ) {}

    list(): Promise<InformedConsentManagement[]> {
        return this.managementRepository.find({
            relations: ['model', 'departments', 'roles'],
            order: { priority: 'ASC', id: 'DESC' },
        });
    }

    async get(id: number): Promise<InformedConsentManagement> {
        const management = await this.managementRepository.findOne(id, {
            relations: ['model', 'departments', 'roles'],
        });
        if (!management) throw new NotFoundException('Informed consent management not found.');
        return management;
    }

    async create(
        input: CreateInformedConsentManagementInput,
        currentUser: User,
    ): Promise<InformedConsentManagement> {
        await this.assertModelReady(input.modelId);
        const parsedConditions = this.parseConditions(input.profileConditionsJson);
        const departments = await this.resolveDepartments(input.departmentIds);
        const roles = await this.resolveRoles(input.roleIds);
        const appliesToAllDepartments = input.appliesToAllDepartments ?? !departments.length;
        const appliesToAllRoles = input.appliesToAllRoles ?? !roles.length;
        this.assertScopeSelection(appliesToAllDepartments, departments.length, appliesToAllRoles, roles.length);
        const scopeHash = this.scopeHash({
            modelId: input.modelId,
            trigger: input.trigger,
            appliesToAllDepartments,
            departmentIds: departments.map(department => department.id),
            appliesToAllRoles,
            roleIds: roles.map(role => role.id),
            profileConditions: parsedConditions,
        });
        if ((input.status ?? InformedConsentManagementStatus.DRAFT) === InformedConsentManagementStatus.ACTIVE) {
            await this.assertNoActiveDuplicate(scopeHash);
        }
        const management = this.managementRepository.create({
            title: input.title,
            description: input.description,
            modelId: input.modelId,
            status: input.status ?? InformedConsentManagementStatus.DRAFT,
            trigger: input.trigger,
            mandatory: input.mandatory ?? true,
            appliesToAllDepartments,
            appliesToAllRoles,
            profileConditions: parsedConditions,
            scopeHash,
            priority: input.priority ?? 100,
            active: input.active ?? true,
            createdById: currentUser?.id,
        });
        management.departments = departments;
        management.roles = roles;
        const saved = await this.managementRepository.save(management);
        return this.get(saved.id);
    }

    async update(input: UpdateInformedConsentManagementInput): Promise<InformedConsentManagement> {
        const management = await this.get(input.id);
        if (input.modelId !== undefined) await this.assertModelReady(input.modelId);
        const parsedConditions = input.profileConditionsJson !== undefined
            ? this.parseConditions(input.profileConditionsJson)
            : management.profileConditions;
        const departments = input.departmentIds !== undefined
            ? await this.resolveDepartments(input.departmentIds)
            : management.departments ?? [];
        const roles = input.roleIds !== undefined
            ? await this.resolveRoles(input.roleIds)
            : management.roles ?? [];
        const next = {
            modelId: input.modelId ?? management.modelId,
            trigger: input.trigger ?? management.trigger,
            appliesToAllDepartments: input.appliesToAllDepartments ?? management.appliesToAllDepartments,
            departmentIds: departments.map(department => department.id),
            appliesToAllRoles: input.appliesToAllRoles ?? management.appliesToAllRoles,
            roleIds: roles.map(role => role.id),
            profileConditions: parsedConditions,
        };
        this.assertScopeSelection(
            next.appliesToAllDepartments,
            next.departmentIds.length,
            next.appliesToAllRoles,
            next.roleIds.length,
        );
        const scopeHash = this.scopeHash(next);
        const nextStatus = input.status ?? management.status;
        if (nextStatus === InformedConsentManagementStatus.ACTIVE) {
            await this.assertNoActiveDuplicate(scopeHash, management.id);
        }
        if (input.title !== undefined) management.title = input.title;
        if (input.description !== undefined) management.description = input.description;
        if (input.modelId !== undefined) management.modelId = input.modelId;
        if (input.status !== undefined) management.status = input.status;
        if (input.trigger !== undefined) management.trigger = input.trigger;
        if (input.mandatory !== undefined) management.mandatory = input.mandatory;
        management.appliesToAllDepartments = next.appliesToAllDepartments;
        management.appliesToAllRoles = next.appliesToAllRoles;
        management.profileConditions = parsedConditions;
        management.scopeHash = scopeHash;
        if (input.priority !== undefined) management.priority = input.priority;
        if (input.active !== undefined) management.active = input.active;
        management.departments = departments;
        management.roles = roles;
        await this.managementRepository.save(management);
        return this.get(management.id);
    }

    async duplicate(id: number, currentUser: User): Promise<InformedConsentManagement> {
        const management = await this.get(id);
        return this.create({
            title: `${management.title} copia`,
            description: management.description,
            modelId: management.modelId,
            status: InformedConsentManagementStatus.DRAFT,
            trigger: management.trigger,
            mandatory: management.mandatory,
            appliesToAllDepartments: management.appliesToAllDepartments,
            departmentIds: management.departments?.map(department => department.id),
            appliesToAllRoles: management.appliesToAllRoles,
            roleIds: management.roles?.map(role => role.id),
            profileConditionsJson: management.profileConditions
                ? JSON.stringify(management.profileConditions)
                : undefined,
            priority: management.priority,
            active: management.active,
        }, currentUser);
    }

    async delete(id: number): Promise<boolean> {
        const result = await this.managementRepository.delete(id);
        return !!result.affected;
    }

    private async assertModelReady(modelId: number): Promise<void> {
        const model = await this.modelRepository.findOne(modelId);
        if (!model) throw new NotFoundException('Informed consent model not found.');
        if (!model.currentPublishedVersionId) {
            throw new BadRequestException('The selected informed consent model has no published version.');
        }
    }

    private parseConditions(value?: string): any {
        if (!value) return undefined;
        try {
            return JSON.parse(value);
        } catch (error) {
            throw new BadRequestException('Profile conditions must be valid JSON.');
        }
    }

    private async resolveDepartments(departmentIds?: number[]): Promise<Department[]> {
        if (!departmentIds?.length) return [];
        return this.departmentRepository.findByIds(departmentIds);
    }

    private async resolveRoles(roleIds?: number[]): Promise<Role[]> {
        if (!roleIds?.length) return [];
        return this.roleRepository.findByIds(roleIds);
    }

    private async assertNoActiveDuplicate(scopeHash: string, currentId?: number): Promise<void> {
        const duplicate = await this.managementRepository.findOne({
            where: {
                scopeHash,
                status: InformedConsentManagementStatus.ACTIVE,
            },
        });
        if (duplicate && duplicate.id !== currentId) {
            throw new BadRequestException('An active informed consent management already exists for this scope.');
        }
    }

    private assertScopeSelection(
        appliesToAllDepartments: boolean,
        departmentCount: number,
        appliesToAllRoles: boolean,
        roleCount: number,
    ): void {
        if (!appliesToAllDepartments && !departmentCount) {
            throw new BadRequestException('Select at least one department or apply to all departments.');
        }
        if (!appliesToAllRoles && !roleCount) {
            throw new BadRequestException('Select at least one role or apply to all roles.');
        }
    }

    private scopeHash(input: {
        modelId: number;
        trigger: string;
        appliesToAllDepartments: boolean;
        departmentIds: number[];
        appliesToAllRoles: boolean;
        roleIds: number[];
        profileConditions?: any;
    }): string {
        const stable = {
            modelId: input.modelId,
            trigger: input.trigger,
            departments: input.appliesToAllDepartments
                ? ['ALL']
                : [...input.departmentIds].sort((a, b) => a - b),
            roles: input.appliesToAllRoles
                ? ['ALL']
                : [...input.roleIds].sort((a, b) => a - b),
            profileConditions: input.profileConditions ?? null,
        };
        return JSON.stringify(stable);
    }
}
