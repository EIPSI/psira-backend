import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { NotificationEvent } from 'src/modules/notification/enums/notification-event.enum';
import { NotificationDispatchService } from 'src/modules/notification/services/notification-dispatch.service';
import { Patient } from 'src/modules/patient/models/patient.model';
import { User } from 'src/modules/user/models/user.model';
import { url } from 'src/shared';
import { createQueryBuilder, Repository } from 'typeorm';
import { AssignmentRequestKind } from '../enums/assignment-request-kind.enum';
import { AssignmentRequestStatus } from '../enums/assignment-request-status.enum';
import { AssignmentRequest } from '../models/assignment-request.model';

@Injectable()
export class AssignmentRequestService {
    constructor(
        @InjectRepository(AssignmentRequest)
        private readonly assignmentRequestRepository: Repository<AssignmentRequest>,
        private readonly notificationDispatchService: NotificationDispatchService,
    ) {}

    pendingForAssignee(assigneeId: number): Promise<AssignmentRequest[]> {
        return this.assignmentRequestRepository.find({
            where: { assigneeId, status: AssignmentRequestStatus.PENDING },
            relations: ['patient', 'therapist', 'assignee', 'requester'],
            order: { createdAt: 'DESC' },
        });
    }

    pendingCaseManagerRequests(patientId: number): Promise<AssignmentRequest[]> {
        return this.assignmentRequestRepository.find({
            where: {
                kind: AssignmentRequestKind.CASE_MANAGER,
                patientId,
                status: AssignmentRequestStatus.PENDING,
            },
            relations: ['patient', 'assignee', 'requester'],
            order: { createdAt: 'DESC' },
        });
    }

    pendingSupervisorRequests(therapistId: number): Promise<AssignmentRequest[]> {
        return this.assignmentRequestRepository.find({
            where: {
                kind: AssignmentRequestKind.SUPERVISOR,
                therapistId,
                status: AssignmentRequestStatus.PENDING,
            },
            relations: ['therapist', 'assignee', 'requester'],
            order: { createdAt: 'DESC' },
        });
    }

    async requestCaseManagerAssignment(patientId: number, assigneeId: number, requesterId: number): Promise<AssignmentRequest> {
        const existingAssigned = await createQueryBuilder()
            .from('patient_case_manager', 'pcm')
            .where('pcm."patientId" = :patientId AND pcm."userId" = :assigneeId', { patientId, assigneeId })
            .getRawOne();
        if (existingAssigned) {
            throw new BadRequestException('This user is already assigned as case manager.');
        }

        const existingPending = await this.assignmentRequestRepository.findOne({
            where: {
                kind: AssignmentRequestKind.CASE_MANAGER,
                patientId,
                assigneeId,
                status: AssignmentRequestStatus.PENDING,
            },
            relations: ['patient', 'assignee', 'requester'],
        });
        if (existingPending) return existingPending;

        const saved = await this.assignmentRequestRepository.save(this.assignmentRequestRepository.create({
            kind: AssignmentRequestKind.CASE_MANAGER,
            status: AssignmentRequestStatus.PENDING,
            patientId,
            assigneeId,
            requesterId,
        }));
        const request = await this.get(saved.id);
        await this.notify(request);
        return request;
    }

    async requestSupervisorAssignment(therapistId: number, assigneeId: number, requesterId: number): Promise<AssignmentRequest> {
        const existingAssigned = await createQueryBuilder()
            .from('therapist_supervisor', 'ts')
            .where('ts."therapistId" = :therapistId AND ts."supervisorId" = :assigneeId', { therapistId, assigneeId })
            .getRawOne();
        if (existingAssigned) {
            throw new BadRequestException('This user is already assigned as supervisor.');
        }

        const existingPending = await this.assignmentRequestRepository.findOne({
            where: {
                kind: AssignmentRequestKind.SUPERVISOR,
                therapistId,
                assigneeId,
                status: AssignmentRequestStatus.PENDING,
            },
            relations: ['therapist', 'assignee', 'requester'],
        });
        if (existingPending) return existingPending;

        const saved = await this.assignmentRequestRepository.save(this.assignmentRequestRepository.create({
            kind: AssignmentRequestKind.SUPERVISOR,
            status: AssignmentRequestStatus.PENDING,
            therapistId,
            assigneeId,
            requesterId,
        }));
        const request = await this.get(saved.id);
        await this.notify(request);
        return request;
    }

    async accept(id: number, currentUserId: number): Promise<AssignmentRequest> {
        const request = await this.getPending(id);
        if (request.assigneeId !== currentUserId) {
            throw new ForbiddenException('Only the requested user can accept this assignment.');
        }

        if (request.kind === AssignmentRequestKind.CASE_MANAGER) {
            await this.insertPatientCaseManager(request.patientId, request.assigneeId);
        } else {
            await this.insertTherapistSupervisor(request.therapistId, request.assigneeId);
        }

        request.status = AssignmentRequestStatus.ACCEPTED;
        request.respondedAt = new Date();
        await this.assignmentRequestRepository.save(request);
        return this.get(request.id);
    }

    async reject(id: number, currentUserId: number): Promise<AssignmentRequest> {
        const request = await this.getPending(id);
        if (request.assigneeId !== currentUserId) {
            throw new ForbiddenException('Only the requested user can reject this assignment.');
        }
        request.status = AssignmentRequestStatus.REJECTED;
        request.respondedAt = new Date();
        await this.assignmentRequestRepository.save(request);
        return this.get(request.id);
    }

    async cancel(id: number, currentUserId: number): Promise<AssignmentRequest> {
        const request = await this.getPending(id);
        if (request.requesterId !== currentUserId && request.assigneeId !== currentUserId) {
            throw new ForbiddenException('Only the requester or the requested user can cancel this assignment request.');
        }
        request.status = AssignmentRequestStatus.CANCELLED;
        request.respondedAt = new Date();
        await this.assignmentRequestRepository.save(request);
        return this.get(request.id);
    }

    private async get(id: number): Promise<AssignmentRequest> {
        const request = await this.assignmentRequestRepository.findOne(id, {
            relations: ['patient', 'therapist', 'assignee', 'requester'],
        });
        if (!request) throw new NotFoundException('Assignment request not found.');
        return request;
    }

    private async getPending(id: number): Promise<AssignmentRequest> {
        const request = await this.get(id);
        if (request.status !== AssignmentRequestStatus.PENDING) {
            throw new BadRequestException('Assignment request is no longer pending.');
        }
        return request;
    }

    private async insertPatientCaseManager(patientId: number, userId: number): Promise<void> {
        if (!patientId) throw new BadRequestException('Patient is required for case-manager assignments.');
        const existing = await createQueryBuilder()
            .from('patient_case_manager', 'pcm')
            .where('pcm."patientId" = :patientId AND pcm."userId" = :userId', { patientId, userId })
            .getRawOne();
        if (existing) return;
        await createQueryBuilder()
            .insert()
            .into('patient_case_manager')
            .values([{ patientId, userId }])
            .execute();
    }

    private async insertTherapistSupervisor(therapistId: number, supervisorId: number): Promise<void> {
        if (!therapistId) throw new BadRequestException('Therapist is required for supervisor assignments.');
        const existing = await createQueryBuilder()
            .from('therapist_supervisor', 'ts')
            .where('ts."therapistId" = :therapistId AND ts."supervisorId" = :supervisorId', { therapistId, supervisorId })
            .getRawOne();
        if (existing) return;
        await createQueryBuilder()
            .insert()
            .into('therapist_supervisor')
            .values([{ therapistId, supervisorId }])
            .execute();
    }

    private async notify(request: AssignmentRequest): Promise<void> {
        const recipient = await User.findOne(request.assigneeId, { relations: ['roles', 'departments'] });
        if (!recipient) return;
        const requester = await User.findOne(request.requesterId);
        const patient = request.patientId ? await Patient.findOne(request.patientId) : null;
        const therapist = request.therapistId ? await User.findOne(request.therapistId) : null;
        const roleLabel = request.kind === AssignmentRequestKind.CASE_MANAGER
            ? 'administrador de caso'
            : 'supervisor';
        const targetName = request.kind === AssignmentRequestKind.CASE_MANAGER
            ? this.patientName(patient)
            : this.userName(therapist);

        await this.notificationDispatchService.dispatchUserEvent({
            event: request.kind === AssignmentRequestKind.CASE_MANAGER
                ? NotificationEvent.CASE_MANAGER_ASSIGNMENT_REQUEST
                : NotificationEvent.CASE_SUPERVISOR_ASSIGNMENT_REQUEST,
            recipient,
            patientId: request.patientId,
            therapistId: request.therapistId,
            data: {
                link: url('dashboard'),
                assignment: {
                    id: request.id,
                    kind: request.kind,
                    roleLabel,
                    targetName,
                    patientName: this.patientName(patient),
                    therapistName: this.userName(therapist),
                    requesterName: this.userName(requester),
                    link: url('dashboard'),
                },
                patient: patient ? {
                    id: patient.id,
                    firstName: patient.firstName,
                    lastName: patient.lastName,
                    fullName: this.patientName(patient),
                    medicalRecordNo: patient.medicalRecordNo,
                } : undefined,
                therapist: therapist ? {
                    id: therapist.id,
                    firstName: therapist.firstName,
                    lastName: therapist.lastName,
                    fullName: this.userName(therapist),
                    email: therapist.email,
                } : undefined,
            },
        });
    }

    private patientName(patient?: Patient): string {
        if (!patient) return '';
        return [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' ');
    }

    private userName(user?: User): string {
        if (!user) return '';
        return [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ');
    }
}
