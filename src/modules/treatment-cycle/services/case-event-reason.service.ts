import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Department } from 'src/modules/department/models/department.model';
import { Repository } from 'typeorm';
import {
    CreateCaseEventReasonTreeInput,
    UpdateCaseEventReasonTreeInput,
} from '../dtos/case-event-reason-tree.input';
import {
    CreateCaseEventReasonInput,
    UpdateCaseEventReasonInput,
} from '../dtos/case-event-reason.input';
import { CaseEventReasonContext } from '../enums/case-event-reason-context.enum';
import { CaseEventReason } from '../models/case-event-reason.model';
import { CaseEventReasonTree } from '../models/case-event-reason-tree.model';

@Injectable()
export class CaseEventReasonService {
    constructor(
        @InjectRepository(CaseEventReason)
        private readonly reasonRepository: Repository<CaseEventReason>,
        @InjectRepository(CaseEventReasonTree)
        private readonly treeRepository: Repository<CaseEventReasonTree>,
        @InjectRepository(Department)
        private readonly departmentRepository: Repository<Department>,
    ) {}

    async getTrees(includeInactive = false): Promise<CaseEventReasonTree[]> {
        const query = this.treeRepository
            .createQueryBuilder('tree')
            .leftJoinAndSelect('tree.department', 'department')
            .orderBy('tree.context', 'ASC')
            .addOrderBy('department.name', 'ASC');

        if (!includeInactive) {
            query.andWhere('tree.active = true');
        }

        return query.getMany();
    }

    async createTree(input: CreateCaseEventReasonTreeInput): Promise<CaseEventReasonTree> {
        await this.assertDepartmentExists(input.departmentId);
        const existing = await this.findTreeByScope(input.context, input.departmentId);
        if (existing) {
            if (existing.active) {
                throw new BadRequestException('Reason tree already exists for this context and department');
            }
            existing.active = true;
            existing.levelLabels = this.normalizeLevelLabels(input.levelLabels);
            return this.treeRepository.save(existing);
        }

        const tree = this.treeRepository.create({
            context: input.context,
            departmentId: input.departmentId ?? null,
            active: true,
            levelLabels: this.normalizeLevelLabels(input.levelLabels),
        });
        return this.treeRepository.save(tree);
    }

    async updateTree(input: UpdateCaseEventReasonTreeInput): Promise<CaseEventReasonTree> {
        const tree = await this.treeRepository.findOne(input.id);
        if (!tree) throw new NotFoundException('Reason tree not found');

        await this.assertDepartmentExists(input.departmentId);
        await this.assertTreeScopeAvailable(input.context, input.departmentId, tree.id);

        await this.reasonRepository
            .createQueryBuilder()
            .update(CaseEventReason)
            .set({
                context: input.context,
                departmentId: input.departmentId ?? null,
            })
            .where('"context" = :context', { context: tree.context })
            .andWhere(tree.departmentId ? '"departmentId" = :departmentId' : '"departmentId" IS NULL', {
                departmentId: tree.departmentId,
            })
            .execute();

        tree.context = input.context;
        tree.departmentId = input.departmentId ?? null;
        tree.levelLabels = this.normalizeLevelLabels(input.levelLabels);
        return this.treeRepository.save(tree);
    }

    async deactivateTree(id: number): Promise<CaseEventReasonTree> {
        const tree = await this.treeRepository.findOne(id);
        if (!tree) throw new NotFoundException('Reason tree not found');

        await this.reasonRepository
            .createQueryBuilder()
            .update(CaseEventReason)
            .set({ active: false })
            .where('"context" = :context', { context: tree.context })
            .andWhere(tree.departmentId ? '"departmentId" = :departmentId' : '"departmentId" IS NULL', {
                departmentId: tree.departmentId,
            })
            .execute();

        tree.active = false;
        return this.treeRepository.save(tree);
    }

    async getReasons(
        context: CaseEventReasonContext,
        parentId?: number | null,
        departmentId?: number | null,
        includeInactive = false,
        exactDepartment = false,
    ): Promise<CaseEventReason[]> {
        const query = this.reasonRepository
            .createQueryBuilder('reason')
            .leftJoinAndSelect('reason.parent', 'parent')
            .leftJoinAndSelect('reason.children', 'children')
            .leftJoinAndSelect('reason.department', 'department')
            .where('reason.context = :context', { context })
            .orderBy('reason."sortOrder"', 'ASC')
            .addOrderBy('reason.label', 'ASC');

        if (parentId === null || parentId === undefined) {
            query.andWhere('reason."parentId" IS NULL');
        } else {
            query.andWhere('reason."parentId" = :parentId', { parentId });
        }

        if (exactDepartment) {
            if (departmentId) {
                query.andWhere('reason."departmentId" = :departmentId', { departmentId });
            } else {
                query.andWhere('reason."departmentId" IS NULL');
            }
        } else if (departmentId) {
            query.andWhere('(reason."departmentId" IS NULL OR reason."departmentId" = :departmentId)', { departmentId });
        } else {
            query.andWhere('reason."departmentId" IS NULL');
        }

        if (!includeInactive) {
            query.andWhere('reason.active = true');
        }

        return query.getMany();
    }

    async createReason(input: CreateCaseEventReasonInput): Promise<CaseEventReason> {
        this.validateLabel(input.label);
        await this.assertDepartmentExists(input.departmentId);
        await this.assertParentCompatible(input.context, input.parentId, input.departmentId);
        await this.ensureTree(input.context, input.departmentId);

        const reason = this.reasonRepository.create({
            context: input.context,
            label: input.label.trim(),
            nextLevelLabel: this.normalizeOptionalText(input.nextLevelLabel),
            parentId: input.parentId,
            departmentId: input.departmentId ?? null,
            active: input.active ?? true,
            isOther: input.isOther ?? false,
            sortOrder: input.sortOrder ?? 0,
        });
        return this.reasonRepository.save(reason);
    }

    async updateReason(input: UpdateCaseEventReasonInput): Promise<CaseEventReason> {
        const reason = await this.reasonRepository.findOne(input.id);
        if (!reason) throw new NotFoundException('Reason not found');

        const nextContext = input.context || reason.context;
        const nextDepartmentId = input.departmentId === undefined
            ? reason.departmentId
            : input.departmentId;
        const nextParentId = input.parentId === undefined
            ? reason.parentId
            : input.parentId;

        if (input.label !== undefined) {
            this.validateLabel(input.label);
            reason.label = input.label.trim();
        }
        if (input.nextLevelLabel !== undefined) {
            reason.nextLevelLabel = this.normalizeOptionalText(input.nextLevelLabel);
        }
        if (input.context !== undefined) reason.context = input.context;
        if (input.departmentId !== undefined) {
            await this.assertDepartmentExists(input.departmentId);
            reason.departmentId = input.departmentId ?? null;
        }
        if (input.parentId !== undefined) {
            await this.assertParentCompatible(nextContext, input.parentId, nextDepartmentId);
            await this.assertParentDoesNotCreateCycle(reason.id, input.parentId);
            reason.parentId = input.parentId ?? null;
        } else {
            await this.assertParentCompatible(nextContext, nextParentId, nextDepartmentId);
        }
        if (input.active !== undefined) reason.active = input.active;
        if (input.isOther !== undefined) reason.isOther = input.isOther;
        if (input.sortOrder !== undefined) reason.sortOrder = input.sortOrder;

        return this.reasonRepository.save(reason);
    }

    async deactivateReason(id: number): Promise<CaseEventReason> {
        const reason = await this.reasonRepository.findOne(id);
        if (!reason) throw new NotFoundException('Reason not found');
        reason.active = false;
        return this.reasonRepository.save(reason);
    }

    async deleteReason(id: number): Promise<boolean> {
        const reason = await this.reasonRepository.findOne(id);
        if (!reason) throw new NotFoundException('Reason not found');
        await this.deleteReasonBranch(reason.id);
        return true;
    }

    async reasonPathSnapshot(reasonId?: number): Promise<string | undefined> {
        if (!reasonId) return undefined;
        const labels: string[] = [];
        let reason = await this.reasonRepository.findOne(reasonId);
        while (reason) {
            labels.unshift(reason.label);
            reason = reason.parentId
                ? await this.reasonRepository.findOne(reason.parentId)
                : undefined;
        }
        return labels.length ? labels.join(' > ') : undefined;
    }

    private validateLabel(label?: string): void {
        if (!label || !label.trim()) {
            throw new BadRequestException('Reason label is required');
        }
    }

    private async assertDepartmentExists(departmentId?: number | null): Promise<void> {
        if (!departmentId) return;
        const count = await this.departmentRepository.count({ where: { id: departmentId } });
        if (!count) throw new BadRequestException('Department was not found');
    }

    private normalizeLevelLabels(levelLabels?: string[]): string[] {
        const labels = (levelLabels || [])
            .map(label => (label || '').trim())
            .filter(label => !!label);
        return labels.length ? labels : ['Motivo', 'Submotivo'];
    }

    private normalizeOptionalText(value?: string): string | undefined {
        const text = (value || '').trim();
        return text || undefined;
    }

    private async deleteReasonBranch(reasonId: number): Promise<void> {
        const children = await this.reasonRepository.find({
            where: { parentId: reasonId },
        });
        for (const child of children) {
            await this.deleteReasonBranch(child.id);
        }
        await this.reasonRepository.delete(reasonId);
    }

    private async ensureTree(
        context: CaseEventReasonContext,
        departmentId?: number | null,
    ): Promise<void> {
        const existing = await this.findTreeByScope(context, departmentId);
        if (existing) return;
        await this.createTree({ context, departmentId });
    }

    private async assertTreeScopeAvailable(
        context: CaseEventReasonContext,
        departmentId?: number | null,
        excludedTreeId?: number,
    ): Promise<void> {
        const existing = await this.findTreeByScope(context, departmentId);
        if (existing && existing.id !== excludedTreeId) {
            throw new BadRequestException('Reason tree already exists for this context and department');
        }
    }

    private findTreeByScope(
        context: CaseEventReasonContext,
        departmentId?: number | null,
    ): Promise<CaseEventReasonTree | undefined> {
        const query = this.treeRepository
            .createQueryBuilder('tree')
            .where('tree.context = :context', { context });

        if (departmentId) {
            query.andWhere('tree."departmentId" = :departmentId', { departmentId });
        } else {
            query.andWhere('tree."departmentId" IS NULL');
        }

        return query.getOne();
    }

    private async assertParentCompatible(
        context: CaseEventReasonContext,
        parentId?: number | null,
        departmentId?: number | null,
    ): Promise<void> {
        if (!parentId) return;
        const parent = await this.reasonRepository.findOne(parentId);
        if (!parent) throw new BadRequestException('Parent reason was not found');
        if (parent.context !== context) {
            throw new BadRequestException('Parent reason belongs to another context');
        }
        if (Number(parent.departmentId || 0) !== Number(departmentId || 0)) {
            throw new BadRequestException('Parent reason belongs to another department scope');
        }
    }

    private async assertParentDoesNotCreateCycle(
        reasonId: number,
        parentId?: number | null,
    ): Promise<void> {
        let currentParentId = parentId;
        while (currentParentId) {
            if (currentParentId === reasonId) {
                throw new BadRequestException('Reason parent cannot create a cycle');
            }
            const parent = await this.reasonRepository.findOne(currentParentId);
            currentParentId = parent?.parentId;
        }
    }
}
