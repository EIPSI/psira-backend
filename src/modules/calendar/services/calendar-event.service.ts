import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Assessment } from 'src/modules/assessment/models/assessment.model';
import { AssessmentOrigin } from 'src/modules/assessment/enums/assessment-origin.enum';
import { AssessmentStatus } from 'src/modules/questionnaire/enums/assessment-status.enum';
import { ClinicalSessionCancellationType } from 'src/modules/clinical-session/enums/clinical-session-cancellation-type.enum';
import { ClinicalSessionKind } from 'src/modules/clinical-session/enums/clinical-session-kind.enum';
import { ClinicalSessionStatus } from 'src/modules/clinical-session/enums/clinical-session-status.enum';
import { ClinicalSession } from 'src/modules/clinical-session/models/clinical-session.model';
import { Department } from 'src/modules/department/models/department.model';
import { Patient } from 'src/modules/patient/models/patient.model';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { Permission } from 'src/modules/permission/models/permission.model';
import { PermissionService } from 'src/modules/permission/providers/permission.service';
import { User } from 'src/modules/user/models/user.model';
import { Repository } from 'typeorm';
import { CalendarEventFilterInput } from '../dtos/calendar-event.input';
import { CalendarEventType } from '../enums/calendar-event-type.enum';
import { CalendarOccurrenceStatus } from '../enums/calendar-occurrence-status.enum';
import { CalendarEvent } from '../models/calendar-event.model';

@Injectable()
export class CalendarEventService {
    constructor(
        @InjectRepository(ClinicalSession)
        private readonly clinicalSessionRepository: Repository<ClinicalSession>,
        @InjectRepository(Assessment)
        private readonly assessmentRepository: Repository<Assessment>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) {}

    async getCalendarEvents(filter: CalendarEventFilterInput, currentUser: User): Promise<CalendarEvent[]> {
        const includeSessions = this.includesType(filter, CalendarEventType.SESSION);
        const includeAssessments = this.includesType(filter, CalendarEventType.ASSESSMENT);
        const viewer = await this.loadViewer(currentUser.id);
        const permissions = await PermissionService.userPermissionGrants(currentUser.id);
        const events: CalendarEvent[] = [];

        if (includeSessions) {
            events.push(...await this.getSessionEvents(filter, viewer, permissions));
        }

        if (includeAssessments) {
            events.push(...await this.getAssessmentEvents(filter, viewer, permissions));
        }

        return events.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    }

    private includesType(filter: CalendarEventFilterInput, type: CalendarEventType): boolean {
        return !filter.types?.length || filter.types.includes(type);
    }

    private async getSessionEvents(
        filter: CalendarEventFilterInput,
        viewer: User,
        permissions: Permission[],
    ): Promise<CalendarEvent[]> {
        const query = this.clinicalSessionRepository
            .createQueryBuilder('session')
            .innerJoinAndSelect('session.calendarOccurrence', 'occurrence')
            .leftJoinAndSelect('session.patient', 'patient')
            .leftJoinAndSelect('patient.departments', 'patientDepartment')
            .leftJoinAndSelect('patient.caseManagers', 'caseManager')
            .leftJoinAndSelect('session.therapist', 'therapist')
            .leftJoinAndSelect('therapist.departments', 'therapistDepartment')
            .leftJoinAndSelect('therapist.supervisors', 'therapistSupervisor')
            .leftJoinAndSelect('session.supervisor', 'supervisor')
            .leftJoinAndSelect('supervisor.departments', 'supervisorDepartment')
            .leftJoinAndSelect('session.responsibleUsers', 'responsibleUser')
            .leftJoinAndSelect('responsibleUser.departments', 'responsibleUserDepartment')
            .where('occurrence."startAt" < :to', { to: filter.to })
            .andWhere('occurrence."endAt" > :from', { from: filter.from })
            .andWhere(
                '(session."cancellationType" IS NULL OR session."cancellationType" != :rescheduledCancellationType)',
                { rescheduledCancellationType: ClinicalSessionCancellationType.RESCHEDULED },
            );

        if (!filter.includeCancelled) {
            query
                .andWhere(
                    `(
                        session."clinicalStatus" != :cancelledSessionStatus
                        OR session."cancellationType" = :noShowCancellationType
                    )`,
                    {
                        cancelledSessionStatus: ClinicalSessionStatus.CANCELLED,
                        noShowCancellationType: ClinicalSessionCancellationType.NO_SHOW,
                    },
                )
                .andWhere(
                    `(
                        occurrence."status" != :cancelledOccurrenceStatus
                        OR session."cancellationType" = :noShowCancellationType
                    )`,
                    {
                        cancelledOccurrenceStatus: CalendarOccurrenceStatus.CANCELLED,
                        noShowCancellationType: ClinicalSessionCancellationType.NO_SHOW,
                    },
                );
        }

        if (filter.patientId) {
            query.andWhere('session."patientId" = :patientId', {
                patientId: filter.patientId,
            });
        }

        if (filter.therapistId) {
            query.andWhere(
                '(session."therapistId" = :therapistId OR responsibleUser.id = :therapistId)',
                { therapistId: filter.therapistId },
            );
        }

        if (filter.supervisorId) {
            query.andWhere(
                '(session."supervisorId" = :supervisorId OR responsibleUser.id = :supervisorId)',
                { supervisorId: filter.supervisorId },
            );
        }

        if (filter.sessionKind) {
            query.andWhere('session."sessionKind" = :sessionKind', {
                sessionKind: filter.sessionKind,
            });
        }

        const sessions = await query.getMany();
        return sessions
            .map(session => {
            const cancelled = session.clinicalStatus === ClinicalSessionStatus.CANCELLED;
            const noShow = session.cancellationType === ClinicalSessionCancellationType.NO_SHOW;
            const departments = this.eventDepartments([
                ...(session.patient?.departments || []),
                ...(session.therapist?.departments || []),
                ...(session.supervisor?.departments || []),
                ...((session.responsibleUsers || []).flatMap(user => user.departments || [])),
            ]);
            const canEdit = !cancelled && this.canAccessSession(session, departments, viewer, permissions, 'edit');
            const canDelete = !cancelled && this.canAccessSession(session, departments, viewer, permissions, 'delete');
            return {
            id: `session:${session.id}`,
            type: CalendarEventType.SESSION,
            title: session.calendarOccurrence.title,
            description: session.clinicalHistory,
            startAt: session.calendarOccurrence.startAt,
            endAt: session.calendarOccurrence.endAt,
            status: session.calendarOccurrence.status,
            color: noShow
                ? '#8c8c8c'
                : session.sessionKind === ClinicalSessionKind.SUPERVISION ? '#9254de' : '#13a8a8',
            editable: canEdit,
            deletable: canDelete,
            occurrenceId: session.calendarOccurrenceId,
            occurrenceType: session.calendarOccurrence.occurrenceType,
            patientId: session.patientId,
            therapistId: session.therapistId,
            supervisorId: session.supervisorId,
            responsibleUserIds: (session.responsibleUsers || []).map(user => user.id),
            clinicalSessionId: session.id,
            sessionKind: session.sessionKind,
            sessionNumber: session.sessionNumber || session.cancelledSessionNumber,
            modality: session.modality,
            cancellationType: session.cancellationType,
            cancellationLabel: session.cancellationLabel,
            cancellationReasonSnapshot: session.cancellationReasonSnapshot,
            cancellationComment: session.cancellationComment,
            patient: session.patient,
            therapist: session.therapist,
            supervisor: session.supervisor,
            departments,
        };
        })
            .filter(event => this.shouldIncludeSessionEvent(event, viewer, permissions, filter));
    }

    private async getAssessmentEvents(
        filter: CalendarEventFilterInput,
        viewer: User,
        permissions: Permission[],
    ): Promise<CalendarEvent[]> {
        const query = this.assessmentRepository
            .createQueryBuilder('assessment')
            .leftJoinAndSelect('assessment.calendarOccurrence', 'occurrence')
            .leftJoinAndSelect('assessment.assessmentType', 'assessmentType')
            .leftJoinAndSelect('assessment.patient', 'patient')
            .leftJoinAndSelect('patient.departments', 'patientDepartment')
            .leftJoinAndSelect('patient.caseManagers', 'caseManager')
            .leftJoinAndSelect('assessment.targetUser', 'targetUser')
            .leftJoinAndSelect('targetUser.departments', 'targetUserDepartment')
            .leftJoinAndSelect('assessment.responderUser', 'responderUser')
            .leftJoinAndSelect('responderUser.departments', 'responderUserDepartment')
            .leftJoinAndSelect('assessment.clinician', 'clinician')
            .leftJoinAndSelect('clinician.departments', 'clinicianDepartment')
            .leftJoinAndSelect('assessment.responsibleUsers', 'responsibleUser')
            .leftJoinAndSelect('responsibleUser.departments', 'responsibleUserDepartment')
            .leftJoinAndSelect('assessment.clinicalSession', 'clinicalSession')
            .leftJoinAndSelect('clinicalSession.therapist', 'sessionTherapist')
            .leftJoinAndSelect('sessionTherapist.supervisors', 'sessionTherapistSupervisor')
            .where('assessment."deliveryDate" IS NOT NULL')
            .andWhere('assessment."expirationDate" IS NOT NULL')
            .andWhere('assessment."deliveryDate" < :to', { to: filter.to })
            .andWhere('assessment."expirationDate" > :from', { from: filter.from })
            .andWhere('(assessment."deleted" IS NULL OR assessment."deleted" = false)')
            .andWhere('assessment."status" != :cancelledStatus', {
                cancelledStatus: AssessmentStatus.CANCELLED,
            });

        if (filter.patientId) {
            query.andWhere('assessment."patientId" = :patientId', {
                patientId: filter.patientId,
            });
        }

        if (filter.therapistId) {
            query.andWhere(
                '(assessment."clinicianId" = :therapistId OR responsibleUser.id = :therapistId)',
                { therapistId: filter.therapistId },
            );
        }

        const assessments = await query.getMany();
        return assessments
            .map(assessment => {
            const sessionBased = assessment.origin === AssessmentOrigin.SESSION_BASED;
            const answered = [
                AssessmentStatus.COMPLETED,
                AssessmentStatus.PARTIALLY_COMPLETED,
            ].includes(assessment.status as AssessmentStatus);
            const cancelled = assessment.status === AssessmentStatus.CANCELLED;
            const departments = this.eventDepartments([
                ...(assessment.patient?.departments || []),
                ...(assessment.targetUser?.departments || []),
                ...(assessment.responderUser?.departments || []),
                ...(assessment.clinician?.departments || []),
                ...((assessment.responsibleUsers || []).flatMap(user => user.departments || [])),
            ]);
            const canEdit = assessment.editableFromAssessmentList &&
                this.canAccessAssessment(assessment, departments, viewer, permissions, 'edit');
            const canDelete = !cancelled &&
                (assessment.editableFromAssessmentList || (sessionBased && !answered)) &&
                this.canAccessAssessment(assessment, departments, viewer, permissions, 'delete');
            return {
            id: `assessment:${assessment.id}`,
            type: CalendarEventType.ASSESSMENT,
            title: assessment.name || assessment.assessmentType?.name || 'Assessment',
            description: assessment.note,
            startAt: assessment.deliveryDate || assessment.date || assessment.createdAt,
            endAt: assessment.expirationDate || assessment.deliveryDate || assessment.createdAt,
            status: assessment.calendarOccurrence?.status,
            color: this.assessmentEventColor(assessment, answered),
            editable: canEdit,
            deletable: canDelete,
            occurrenceId: assessment.calendarOccurrenceId,
            occurrenceType: assessment.calendarOccurrence?.occurrenceType,
            patientId: assessment.patientId,
            therapistId: assessment.clinicianId,
            responsibleUserIds: (assessment.responsibleUsers || []).map(user => user.id),
            clinicalSessionId: assessment.clinicalSessionId,
            assessmentId: assessment.id,
            clinicalSessionResourceId: assessment.clinicalSessionResourceId,
            assessmentOrigin: assessment.origin,
            patient: assessment.patient,
            therapist: assessment.clinician,
            targetUser: assessment.targetUser,
            responderUser: assessment.responderUser,
            departments,
        };
        })
            .filter(event => this.shouldIncludeAssessmentEvent(event, viewer, permissions, filter));
    }

    private assessmentEventColor(assessment: Assessment, answered: boolean): string {
        if (answered) return '#95de64';
        if (assessment.status === AssessmentStatus.EXPIRED) return '#ffa39e';
        return assessment.editableFromAssessmentList ? '#2f80ed' : '#1d4ed8';
    }

    private async loadViewer(userId: number): Promise<User> {
        return this.userRepository.findOne({
            where: { id: userId },
            relations: [
                'departments',
                'roles',
                'caseManagedPatients',
                'supervisedTherapists',
                'patients',
            ],
        });
    }

    private shouldIncludeSessionEvent(
        event: CalendarEvent,
        viewer: User,
        permissions: Permission[],
        filter: CalendarEventFilterInput,
    ): boolean {
        if (!this.hasAnyPermission(permissions, [
            PermissionEnum.CLINICAL_VIEW_ALL,
            PermissionEnum.CLINICAL_VIEW_DEPARTMENT,
            PermissionEnum.CLINICAL_VIEW_ASSIGNED,
        ])) return false;
        if (!this.matchesDepartmentFilter(event, viewer, permissions, filter, 'view', 'clinical')) return false;
        if (!this.hasExplicitVisibilityFilter(filter)) {
            return this.canAccessSessionEvent(event, viewer, permissions, 'view');
        }
        const own = this.isOwnSessionEvent(event, viewer);
        const managed = this.isManagedSessionEvent(event, viewer);
        const permitted = this.canAccessSessionEvent(event, viewer, permissions, 'view');
        return !!(
            (filter.includeOwnEvents !== false && own) ||
            (filter.includeManagedEvents && managed && !own) ||
            (filter.includePermittedEvents && permitted && !own && !managed)
        );
    }

    private shouldIncludeAssessmentEvent(
        event: CalendarEvent,
        viewer: User,
        permissions: Permission[],
        filter: CalendarEventFilterInput,
    ): boolean {
        if (!this.hasAnyPermission(permissions, [
            PermissionEnum.ASSESSMENTS_VIEW_ALL,
            PermissionEnum.ASSESSMENTS_VIEW_DEPARTMENT,
            PermissionEnum.ASSESSMENTS_VIEW_ASSIGNED,
        ])) return false;
        if (!this.matchesDepartmentFilter(event, viewer, permissions, filter, 'view', 'assessments')) return false;
        if (!this.hasExplicitVisibilityFilter(filter)) {
            return this.canAccessAssessmentEvent(event, viewer, permissions, 'view');
        }
        const own = this.isOwnAssessmentEvent(event, viewer);
        const managed = this.isManagedAssessmentEvent(event, viewer);
        const permitted = this.canAccessAssessmentEvent(event, viewer, permissions, 'view');
        return !!(
            (filter.includeOwnEvents !== false && own) ||
            (filter.includeManagedEvents && managed && !own) ||
            (filter.includePermittedEvents && permitted && !own && !managed)
        );
    }

    private hasExplicitVisibilityFilter(filter: CalendarEventFilterInput): boolean {
        return filter.includeOwnEvents !== undefined ||
            filter.includeManagedEvents !== undefined ||
            filter.includePermittedEvents !== undefined;
    }

    private canAccessSession(
        session: ClinicalSession,
        departments: Department[],
        viewer: User,
        permissions: Permission[],
        action: 'view' | 'edit' | 'delete',
    ): boolean {
        const event = {
            patientId: session.patientId,
            therapistId: session.therapistId,
            supervisorId: session.supervisorId,
            responsibleUserIds: (session.responsibleUsers || []).map(user => user.id),
            patient: session.patient,
            therapist: session.therapist,
            supervisor: session.supervisor,
            departments,
        } as CalendarEvent;
        return this.canAccessSessionEvent(event, viewer, permissions, action);
    }

    private canAccessAssessment(
        assessment: Assessment,
        departments: Department[],
        viewer: User,
        permissions: Permission[],
        action: 'view' | 'edit' | 'delete',
    ): boolean {
        const event = {
            patientId: assessment.patientId,
            therapistId: assessment.clinicianId,
            responsibleUserIds: (assessment.responsibleUsers || []).map(user => user.id),
            patient: assessment.patient,
            therapist: assessment.clinician,
            targetUser: assessment.targetUser,
            responderUser: assessment.responderUser,
            departments,
        } as CalendarEvent;
        return this.canAccessAssessmentEvent(event, viewer, permissions, action);
    }

    private canAccessSessionEvent(
        event: CalendarEvent,
        viewer: User,
        permissions: Permission[],
        action: 'view' | 'edit' | 'delete',
    ): boolean {
        if (this.hasPermission(permissions, this.permissionName('clinical', action, 'all'))) return true;
        if (
            this.hasPermission(permissions, this.permissionName('clinical', action, 'department')) &&
            this.intersects(this.departmentIds(event.departments), this.userDepartmentIds(viewer))
        ) return true;
        return this.hasPermission(permissions, this.permissionName('clinical', action, 'assigned')) &&
            (this.isOwnSessionEvent(event, viewer) || this.isManagedSessionEvent(event, viewer));
    }

    private canAccessAssessmentEvent(
        event: CalendarEvent,
        viewer: User,
        permissions: Permission[],
        action: 'view' | 'edit' | 'delete',
    ): boolean {
        if (this.hasPermission(permissions, this.permissionName('assessments', action, 'all'))) return true;
        if (
            this.hasPermission(permissions, this.permissionName('assessments', action, 'department')) &&
            this.intersects(this.departmentIds(event.departments), this.userDepartmentIds(viewer))
        ) return true;
        return this.hasPermission(permissions, this.permissionName('assessments', action, 'assigned')) &&
            (this.isOwnAssessmentEvent(event, viewer) || this.isManagedAssessmentEvent(event, viewer));
    }

    private matchesDepartmentFilter(
        event: CalendarEvent,
        viewer: User,
        permissions: Permission[],
        filter: CalendarEventFilterInput,
        action: 'view' | 'edit' | 'delete',
        resource: 'clinical' | 'assessments',
    ): boolean {
        const eventDepartmentIds = this.departmentIds(event.departments);
        const selectedDepartmentIds = (filter.departmentIds || []).map(id => Number(id)).filter(id => Number.isFinite(id));
        if (selectedDepartmentIds.length && !this.intersects(eventDepartmentIds, selectedDepartmentIds)) return false;
        if (this.hasPermission(permissions, this.permissionName(resource, action, 'all'))) return true;
        return !eventDepartmentIds.length || this.intersects(eventDepartmentIds, this.userDepartmentIds(viewer));
    }

    private isOwnSessionEvent(event: CalendarEvent, viewer: User): boolean {
        const userId = Number(viewer.id);
        return event.therapistId === userId ||
            event.supervisorId === userId ||
            event.responsibleUserIds?.includes(userId) ||
            event.patient?.userId === userId;
    }

    private isManagedSessionEvent(event: CalendarEvent, viewer: User): boolean {
        const patientIds = (viewer.caseManagedPatients || []).map(patient => Number(patient.id));
        const therapistIds = (viewer.supervisedTherapists || []).map(user => Number(user.id));
        return (!!event.patientId && patientIds.includes(Number(event.patientId))) ||
            (!!event.therapistId && therapistIds.includes(Number(event.therapistId)));
    }

    private isOwnAssessmentEvent(event: CalendarEvent, viewer: User): boolean {
        const userId = Number(viewer.id);
        return event.responderUser?.id === userId || event.targetUser?.id === userId;
    }

    private isManagedAssessmentEvent(event: CalendarEvent, viewer: User): boolean {
        const userId = Number(viewer.id);
        const patientIds = (viewer.caseManagedPatients || []).map(patient => Number(patient.id));
        const therapistIds = (viewer.supervisedTherapists || []).map(user => Number(user.id));
        return event.responsibleUserIds?.includes(userId) ||
            event.therapistId === userId ||
            (!!event.patientId && patientIds.includes(Number(event.patientId))) ||
            (!!event.therapistId && therapistIds.includes(Number(event.therapistId)));
    }

    private eventDepartments(departments: Department[]): Department[] {
        const byId = new Map<number, Department>();
        (departments || []).forEach(department => {
            if (department?.id) byId.set(Number(department.id), department);
        });
        return [...byId.values()];
    }

    private departmentIds(departments?: Department[]): number[] {
        return (departments || []).map(department => Number(department.id)).filter(id => Number.isFinite(id));
    }

    private userDepartmentIds(user: User): number[] {
        return this.departmentIds(user?.departments || []);
    }

    private intersects(left: number[], right: number[]): boolean {
        return left.some(value => right.includes(value));
    }

    private permissionName(resource: 'clinical' | 'assessments', action: 'view' | 'edit' | 'delete', scope: 'all' | 'department' | 'assigned'): string {
        return `${resource}.${action}.${scope}`;
    }

    private hasPermission(permissions: Permission[], permission: string): boolean {
        return PermissionService.hasPermission(permissions, permission);
    }

    private hasAnyPermission(permissions: Permission[], permissionNames: string[]): boolean {
        return permissionNames.some(permission => this.hasPermission(permissions, permission));
    }
}
