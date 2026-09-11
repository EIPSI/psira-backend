import { ForbiddenException, Injectable } from '@nestjs/common';
import { User } from 'src/modules/user/models/user.model';
import { PermissionService } from './permission.service';

export type AuthorizationResource =
    | 'users'
    | 'patients'
    | 'therapists'
    | 'supervisors'
    | 'caregivers'
    | 'clinical'
    | 'assessments'
    | 'questionnaires'
    | 'questionnaire-bundles'
    | 'evaluation-schemes'
    | 'randomizations'
    | 'automations'
    | 'notifications'
    | 'notification-logs'
    | 'mail-templates'
    | 'informed-consent-models'
    | 'informed-consent-management'
    | 'informed-consent-responses'
    | 'reports'
    | 'departments'
    | 'roles'
    | 'permissions'
    | 'settings'
    | 'system';

export type AuthorizationAction =
    | 'view'
    | 'create'
    | 'edit'
    | 'delete'
    | 'restore'
    | 'archive'
    | 'assign'
    | 'review'
    | 'test';

export type AuthorizationScope =
    | 'own'
    | 'assigned'
    | 'department'
    | 'department-hierarchy'
    | 'all';

export interface AuthorizationTarget {
    userId?: number;
    patientId?: number;
    therapistId?: number;
    supervisorId?: number;
    caregiverId?: number;
    departmentIds?: number[];
    roleHierarchy?: number;
}

export interface AuthorizationDecision {
    allowed: boolean;
    scope?: AuthorizationScope;
    reason?: string;
}

@Injectable()
export class AuthorizationPolicyService {
    constructor(private readonly permissionService: PermissionService) {}

    async can(
        user: User,
        request: {
            resource: AuthorizationResource;
            action: AuthorizationAction;
            target?: AuthorizationTarget;
        },
    ): Promise<AuthorizationDecision> {
        const scopes: AuthorizationScope[] = [
            'all',
            'department',
            'department-hierarchy',
            'assigned',
            'own',
        ];

        for (const scope of scopes) {
            const permission = `${request.resource}.${request.action}.${scope}`;
            if (await this.permissionService.userCan(user.id, permission)) {
                return { allowed: true, scope };
            }
        }

        return {
            allowed: false,
            reason: `Missing permission for ${request.resource}.${request.action}`,
        };
    }

    async assertCan(
        user: User,
        request: {
            resource: AuthorizationResource;
            action: AuthorizationAction;
            target?: AuthorizationTarget;
        },
    ): Promise<AuthorizationDecision> {
        const decision = await this.can(user, request);
        if (!decision.allowed) {
            throw new ForbiddenException(decision.reason || 'Permission denied');
        }
        return decision;
    }
}
