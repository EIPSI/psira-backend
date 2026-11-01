import { systemPermissions } from './enums/permission.enum';
import { RoleCode } from './enums/role-code.enum';

export const researchRoleDefaults = [
    { code: RoleCode.RESEARCH_ADMIN, name: 'Research Administrator', hierarchy: 100 },
    { code: RoleCode.PROJECT_RESEARCHER, name: 'Project Researcher', hierarchy: 200 },
];

const researchResources = new Set(['users', 'patients', 'therapists', 'supervisors', 'caregivers', 'clinical',
    'assessments', 'questionnaires', 'questionnaire-bundles', 'evaluation-schemes', 'randomizations', 'automations',
    'notifications', 'notification-logs', 'mail-templates', 'informed-consent-models', 'informed-consent-management',
    'informed-consent-responses', 'reports', 'clinical-settings', 'data-exports']);

export function researchPermissionNames(code: RoleCode): string[] {
    const global = code === RoleCode.RESEARCH_ADMIN;
    return systemPermissions.map(permission => permission.name).filter(name => {
        const [resource, action, scope] = name.split('.');
        if (researchResources.has(resource)) return scope === (global ? 'all' : 'department');
        if (resource === 'departments' || resource === 'settings') return scope === (global ? 'all' : 'department');
        if (resource === 'roles' || resource === 'permissions') return scope === (global ? 'all' : 'department-hierarchy');
        return false;
    });
}
