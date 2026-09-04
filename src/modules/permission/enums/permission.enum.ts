type PermissionDefinition = {
    key: string;
    name: string;
    group: string;
};

const permission = (
    key: string,
    name: string,
    group: string,
): PermissionDefinition => ({ key, name, group });

const scoped = (
    resourceKey: string,
    resourceName: string,
    group: string,
    actions: string[],
    scopes: string[],
): PermissionDefinition[] =>
    actions.flatMap(action =>
        scopes.map(scope =>
            permission(
                `${resourceKey}_${action}_${scope}`.toUpperCase(),
                `${resourceName}.${action}.${scope}`.replace(/_/g, '-'),
                group,
            ),
        ),
    );

export const systemPermissions = [
    ...scoped('users', 'users', 'User Management', ['view', 'create', 'edit', 'delete', 'restore'], ['all', 'department', 'department_hierarchy']),
    ...scoped('patients', 'patients', 'Patient Management', ['view', 'create', 'edit', 'delete', 'archive', 'restore'], ['all', 'department', 'assigned']),
    ...scoped('therapists', 'therapists', 'Therapists', ['view', 'create', 'edit', 'delete'], ['all', 'department', 'assigned']),
    ...scoped('supervisors', 'supervisors', 'Supervisors', ['view', 'create', 'edit', 'delete'], ['all', 'department']),
    ...scoped('caregivers', 'caregivers', 'Caregiver Management', ['view', 'create', 'edit', 'delete'], ['all', 'department', 'assigned']),
    ...scoped('clinical', 'clinical', 'Clinical Work', ['view', 'create', 'edit', 'delete'], ['all', 'department', 'assigned']),
    ...scoped('assessments', 'assessments', 'Assessments', ['view', 'create', 'edit', 'delete', 'archive', 'restore', 'assign'], ['all', 'department', 'assigned']),
    ...scoped('questionnaires', 'questionnaires', 'Questionnaires', ['view', 'create', 'edit', 'delete'], ['all', 'department']),
    ...scoped('questionnaire_bundles', 'questionnaire-bundles', 'Questionnaire Bundles', ['view', 'create', 'edit', 'delete'], ['all', 'department']),
    ...scoped('evaluation_schemes', 'evaluation-schemes', 'Evaluation Schemes', ['view', 'create', 'edit', 'delete'], ['all', 'department']),
    ...scoped('randomizations', 'randomizations', 'Randomizations', ['view', 'create', 'edit', 'delete'], ['all', 'department']),
    ...scoped('automations', 'automations', 'Evaluation Automations', ['view', 'create', 'edit', 'delete', 'test'], ['all', 'department']),
    ...scoped('notifications', 'notifications', 'Notifications', ['view', 'create', 'edit', 'delete'], ['all', 'department']),
    ...scoped('notification_logs', 'notification-logs', 'Notifications', ['view'], ['all', 'department']),
    ...scoped('mail_templates', 'mail-templates', 'Mail Templates', ['view', 'create', 'edit', 'delete'], ['all', 'department']),
    ...scoped('informed_consent_models', 'informed-consent-models', 'Informed Consent', ['view', 'create', 'edit', 'delete'], ['all', 'department']),
    ...scoped('informed_consent_management', 'informed-consent-management', 'Informed Consent', ['view', 'create', 'edit', 'delete'], ['all', 'department']),
    ...scoped('informed_consent_responses', 'informed-consent-responses', 'Informed Consent', ['view', 'review'], ['all', 'department', 'assigned']),
    ...scoped('reports', 'reports', 'Reports', ['view', 'create', 'edit', 'delete'], ['all', 'department', 'assigned']),
    ...scoped('departments', 'departments', 'Departments', ['view', 'create', 'edit', 'delete'], ['all']),
    ...scoped('roles', 'roles', 'Roles and Permissions', ['view', 'create', 'edit', 'delete'], ['all', 'department_hierarchy']),
    ...scoped('permissions', 'permissions', 'Roles and Permissions', ['view', 'assign'], ['all', 'department_hierarchy']),
    ...scoped('settings', 'settings', 'System Configuration', ['view', 'edit'], ['all']),
    ...scoped('system', 'system', 'System Configuration', ['view', 'edit'], ['all']),
] as const;

type PermissionType = {
    [key in typeof systemPermissions[number]['key']]: string;
};

const flattenedPermissions = {} as PermissionType;
for (const item of systemPermissions) {
    flattenedPermissions[item.key] = item.name;
}

export const PermissionEnum = flattenedPermissions;
