import { ForbiddenException } from '@nestjs/common';
import { In } from 'typeorm';
import { User } from 'src/modules/user/models/user.model';
import { Patient } from 'src/modules/patient/models/patient.model';
import { ClinicalSession } from 'src/modules/clinical-session/models/clinical-session.model';
import { Assessment } from 'src/modules/assessment/models/assessment.model';
import { PermissionService } from 'src/modules/permission/providers/permission.service';

export const uniqueIds = (ids: number[] = []): number[] => [...new Set(ids.map(Number).filter(Boolean))];
export const intersection = (left: number[], right: number[]): number[] => uniqueIds(left).filter(id => right.includes(id));
export const departmentIds = (person?: { departments?: { id: number }[] }): number[] => uniqueIds(person?.departments?.map(item => item.id));

// A session belongs to its clinical pair, never to the union of everyone mentioned by it.
export function sessionDepartmentIds(session: Partial<ClinicalSession>): number[] {
    const supervision = session.sessionKind === 'SUPERVISION';
    const subject = supervision ? session.therapist : session.patient;
    const responsibles = session.responsibleUsers?.length
        ? session.responsibleUsers : [supervision ? session.supervisor : session.therapist].filter(Boolean);
    return intersection(departmentIds(subject), uniqueIds(responsibles.flatMap(person => departmentIds(person))));
}

export class ClinicalAccess {
    static async viewer(userId: number): Promise<User> {
        return User.findOneOrFail(userId, { relations: ['roles', 'departments', 'caseManagedPatients', 'supervisedTherapists'] });
    }
    static async grants(userId: number): Promise<string[]> {
        return (await PermissionService.userPermissionGrants(userId)).map(item => item.name);
    }
    static all(viewer: User, grants: string[], resource: string, action: string): boolean {
        return !!viewer.isSuperUser || viewer.roles?.some(role => role.code === 'SUPER_ADMIN') || grants.includes(`${resource}.${action}.all`);
    }
    static manages(viewer: User, patientId?: number, therapistId?: number): boolean {
        return !!patientId && viewer.caseManagedPatients?.some(patient => Number(patient.id) === Number(patientId)) ||
            !!therapistId && viewer.supervisedTherapists?.some(person => Number(person.id) === Number(therapistId));
    }
    static canSession(session: Partial<ClinicalSession>, viewer: User, grants: string[], action: string): boolean {
        if (this.all(viewer, grants, 'clinical', action)) return true;
        if (grants.includes(`clinical.${action}.department`) && intersection(departmentIds(viewer), sessionDepartmentIds(session)).length) return true;
        if (!grants.includes(`clinical.${action}.assigned`)) return false;
        const responsibleIds = uniqueIds([...(session.responsibleUsers || []).map(user => user.id),
            session.sessionKind === 'SUPERVISION' ? session.supervisorId : session.therapistId]);
        if (action !== 'view') return responsibleIds.includes(Number(viewer.id));
        return responsibleIds.includes(Number(viewer.id)) || session.patient?.userId === viewer.id ||
            session.sessionKind === 'SUPERVISION' && Number(session.therapistId) === Number(viewer.id) ||
            this.manages(viewer, session.patientId, session.sessionKind === 'SUPERVISION' ? session.therapistId : undefined);
    }
    static async session(id: number): Promise<ClinicalSession> {
        return ClinicalSession.findOneOrFail(id, { relations: ['patient', 'patient.departments', 'therapist', 'therapist.departments',
            'supervisor', 'supervisor.departments', 'responsibleUsers', 'responsibleUsers.departments'] });
    }
    static async loadAssessmentScopes(assessments: Assessment[]): Promise<void> {
        const sessionIds = uniqueIds(assessments.map(item => item.clinicalSessionId));
        const userIds = uniqueIds(assessments.flatMap(item => [item.targetUserId, item.responderUserId]));
        const patientIds = uniqueIds(assessments.map(item => item.patientId));
        const [sessions, users, patients] = await Promise.all([
            sessionIds.length ? ClinicalSession.find({ where: { id: In(sessionIds) }, relations: ['patient', 'patient.departments',
                'therapist', 'therapist.departments', 'supervisor', 'supervisor.departments', 'responsibleUsers', 'responsibleUsers.departments'] }) : [],
            userIds.length ? User.find({ where: { id: In(userIds) }, relations: ['departments'] }) : [],
            patientIds.length ? Patient.find({ where: { id: In(patientIds) }, relations: ['departments'] }) : [],
        ]);
        const sessionMap = new Map(sessions.map(item => [item.id, item]));
        const userMap = new Map(users.map(item => [item.id, item]));
        const patientMap = new Map(patients.map(item => [item.id, item]));
        for (const assessment of assessments) {
            const session = sessionMap.get(assessment.clinicalSessionId);
            const target = userMap.get(assessment.targetUserId);
            const responder = userMap.get(assessment.responderUserId);
            const patient = patientMap.get(assessment.patientId);
            if (session) assessment.clinicalSession = Object.assign(assessment.clinicalSession || session, session);
            if (target) assessment.targetUser = Object.assign(assessment.targetUser || target, target);
            if (responder) assessment.responderUser = Object.assign(assessment.responderUser || responder, responder);
            if (patient) assessment.patient = Object.assign(assessment.patient || patient, patient);
        }
    }
    static async assessmentDepartments(assessment: Assessment): Promise<number[]> {
        if (assessment.clinicalSessionId) return sessionDepartmentIds(assessment.clinicalSession?.patient?.departments || assessment.clinicalSession?.therapist?.departments
            ? assessment.clinicalSession : await this.session(assessment.clinicalSessionId));
        if (assessment.automationId) return uniqueIds(assessment.departmentIds || []);
        if (assessment.targetUserId) return departmentIds(assessment.targetUser?.departments ? assessment.targetUser : await User.findOne(assessment.targetUserId, { relations: ['departments'] }));
        if (assessment.patientId) return departmentIds(assessment.patient?.departments ? assessment.patient : await Patient.findOne(assessment.patientId, { relations: ['departments'] }));
        return departmentIds(assessment.responderUser?.departments ? assessment.responderUser : await User.findOne(assessment.responderUserId, { relations: ['departments'] }));
    }
    static async canAssessment(assessment: Assessment, viewer: User, grants: string[], action: string): Promise<boolean> {
        if (this.all(viewer, grants, 'assessments', action)) return true;
        const departments = await this.assessmentDepartments(assessment);
        if (grants.includes(`assessments.${action}.department`) && intersection(departmentIds(viewer), departments).length) return true;
        if (!grants.includes(`assessments.${action}.assigned`)) return false;
        if (assessment.clinicalSessionId && action !== 'view') {
            return this.canSession(assessment.clinicalSession?.responsibleUsers ? assessment.clinicalSession : await this.session(assessment.clinicalSessionId), viewer, grants, action);
        }
        return assessment.responderUserId === viewer.id || assessment.targetUserId === viewer.id ||
            this.manages(viewer, assessment.patientId, assessment.targetUserId);
    }
    static async assertAssessment(assessment: Assessment, currentUser: User, action: string): Promise<void> {
        if (!await this.canAssessment(assessment, await this.viewer(currentUser.id), await this.grants(currentUser.id), action)) {
            throw new ForbiddenException('You cannot modify this assessment or another responsible user’s session');
        }
    }
    static async assertTarget(user: User, patientId?: number, targetUserId?: number): Promise<void> {
        if (!patientId && !targetUserId) throw new ForbiddenException('A clinical target is required');
        const viewer = await this.viewer(user.id), grants = await this.grants(user.id);
        if (this.all(viewer, grants, 'assessments', 'create')) return;
        if (grants.includes('assessments.create.assigned') && this.manages(viewer, patientId, targetUserId)) return;
        const target = patientId ? await Patient.findOne(patientId, { relations: ['departments'] })
            : await User.findOne(targetUserId, { relations: ['departments'] });
        if (grants.includes('assessments.create.department') && intersection(departmentIds(viewer), departmentIds(target)).length) return;
        throw new ForbiddenException('You cannot create evaluations for this clinical target');
    }
    static async users(ids: number[]): Promise<User[]> {
        return ids.length ? User.find({ where: { id: In(uniqueIds(ids)), active: true }, relations: ['departments', 'roles'] }) : [];
    }
}
