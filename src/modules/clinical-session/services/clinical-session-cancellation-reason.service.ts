import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
    CreateClinicalSessionCancellationReasonInput,
    UpdateClinicalSessionCancellationReasonInput,
} from '../dtos/clinical-session-cancellation-reason.input';
import { ClinicalSessionCancellationReason } from '../models/clinical-session-cancellation-reason.model';

@Injectable()
export class ClinicalSessionCancellationReasonService {
    constructor(
        @InjectRepository(ClinicalSessionCancellationReason)
        private readonly reasonRepository: Repository<ClinicalSessionCancellationReason>,
    ) {}

    async getReasons(
        parentId?: number | null,
        includeInactive = false,
    ): Promise<ClinicalSessionCancellationReason[]> {
        const query = this.reasonRepository
            .createQueryBuilder('reason')
            .leftJoinAndSelect('reason.parent', 'parent')
            .leftJoinAndSelect('reason.children', 'children')
            .orderBy('reason."sortOrder"', 'ASC')
            .addOrderBy('reason.label', 'ASC');

        if (parentId === null || parentId === undefined) {
            query.where('reason."parentId" IS NULL');
        } else {
            query.where('reason."parentId" = :parentId', { parentId });
        }

        if (!includeInactive) {
            query.andWhere('reason.active = true');
        }

        return query.getMany();
    }

    async createReason(
        input: CreateClinicalSessionCancellationReasonInput,
    ): Promise<ClinicalSessionCancellationReason> {
        await this.assertParentExists(input.parentId);
        const reason = this.reasonRepository.create({
            label: input.label,
            parentId: input.parentId,
            active: input.active ?? true,
            sortOrder: input.sortOrder ?? 0,
        });
        return this.reasonRepository.save(reason);
    }

    async updateReason(
        input: UpdateClinicalSessionCancellationReasonInput,
    ): Promise<ClinicalSessionCancellationReason> {
        const reason = await this.reasonRepository.findOne(input.id);
        if (!reason) {
            throw new NotFoundException('Cancellation reason not found');
        }

        if (input.parentId !== undefined) {
            await this.assertParentExists(input.parentId);
            await this.assertParentDoesNotCreateCycle(reason.id, input.parentId);
            reason.parentId = input.parentId;
        }
        if (input.label !== undefined) reason.label = input.label;
        if (input.active !== undefined) reason.active = input.active;
        if (input.sortOrder !== undefined) reason.sortOrder = input.sortOrder;

        return this.reasonRepository.save(reason);
    }

    async deactivateReason(id: number): Promise<ClinicalSessionCancellationReason> {
        const reason = await this.reasonRepository.findOne(id);
        if (!reason) {
            throw new NotFoundException('Cancellation reason not found');
        }
        reason.active = false;
        return this.reasonRepository.save(reason);
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

    private async assertParentExists(parentId?: number): Promise<void> {
        if (!parentId) return;
        const parent = await this.reasonRepository.findOne(parentId);
        if (!parent) {
            throw new BadRequestException('Parent cancellation reason was not found');
        }
    }

    private async assertParentDoesNotCreateCycle(
        reasonId: number,
        parentId?: number,
    ): Promise<void> {
        let currentParentId = parentId;
        while (currentParentId) {
            if (currentParentId === reasonId) {
                throw new BadRequestException('Cancellation reason parent cannot create a cycle');
            }
            const parent: ClinicalSessionCancellationReason | undefined =
                await this.reasonRepository.findOne(currentParentId);
            currentParentId = parent?.parentId;
        }
    }
}
