import { BadRequestException } from '@nestjs/common';
import { Patient } from 'src/modules/patient/models/patient.model';
import { User } from 'src/modules/user/models/user.model';
import { PatientCaregiver } from 'src/modules/caregiver/models/patient-caregiver.model';
import { ClinicalAccess, uniqueIds } from './clinical-access';

export interface ResponderContext {
    patientId?: number;
    targetUserId?: number;
    therapistId?: number;
    supervisorId?: number;
    responsibleUserIds?: number[];
    sessionKind?: string;
}

function uniqueRoles(value?: string): string[] {
    return [...new Set(String(value || '').split(',').map(role => role.trim().toUpperCase()).filter(Boolean))];
}

export async function clinicalResponders(roles: string | undefined, context: ResponderContext, fallbackId?: number): Promise<User[]> {
    const requested = uniqueRoles(roles);
    if (!requested.length) return ClinicalAccess.users(fallbackId ? [fallbackId] : []);
    const patient = context.patientId ? await Patient.findOne(context.patientId, { relations: ['caseManagers'] }) : undefined;
    const ids: number[] = [];
    for (const role of requested) {
        let candidates: number[] = [];
        if (role === 'PATIENT') candidates = [patient?.userId || context.targetUserId];
        if (role === 'THERAPIST' || role === 'CASE_MANAGER') {
            candidates = context.sessionKind === 'SUPERVISION' ? [context.therapistId || context.targetUserId]
                : context.responsibleUserIds?.length ? context.responsibleUserIds
                : context.therapistId ? [context.therapistId] : patient?.caseManagers?.map(user => user.id) || [context.targetUserId];
        }
        if (role === 'CAREGIVER' && patient) {
            const links = await PatientCaregiver.find({ where: { patientId: patient.id }, relations: ['caregiver'] });
            candidates = links.map(link => link.caregiver?.userId);
        }
        if (role === 'SUPERVISOR') {
            if (context.supervisorId) candidates = [context.supervisorId];
            else {
                const therapists = await ClinicalAccess.users(uniqueIds([context.therapistId, ...(context.responsibleUserIds || [])]));
                for (const therapist of therapists) {
                    const scoped = await User.findOne(therapist.id, { relations: ['supervisors'] });
                    candidates.push(...(scoped?.supervisors || []).map(user => user.id));
                }
            }
        }
        if (role === 'USER' || role === 'OTHER_USER') candidates = [context.targetUserId || fallbackId];
        const users = await ClinicalAccess.users(uniqueIds(candidates));
        if (!users.length) throw new BadRequestException(`No linked active responder is available for configured role ${role}`);
        ids.push(...users.map(user => user.id));
    }
    return ClinicalAccess.users(uniqueIds(ids));
}
