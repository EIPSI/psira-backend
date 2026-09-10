import { Injectable } from '@nestjs/common';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { PermissionService } from 'src/modules/permission/providers/permission.service';
import { MasterExportDataset, MasterExportFilter } from '../models/master-export-dataset.model';
import { User } from 'src/modules/user/models/user.model';

type MasterExportDatasetDefinition = Omit<MasterExportDataset, 'available'>;

const processingModes = {
    raw: 'RAW',
    processedLong: 'PROCESSED_LONG',
    processedWide: 'PROCESSED_WIDE',
};

const filters: Record<string, MasterExportFilter> = {
    dateRange: {
        key: 'dateRange',
        label: 'Date range',
        type: 'DATE_RANGE',
        required: false,
    },
    department: {
        key: 'department',
        label: 'Department',
        type: 'DEPARTMENT_MULTI_SELECT',
        required: false,
    },
    role: {
        key: 'role',
        label: 'Role',
        type: 'ROLE_MULTI_SELECT',
        required: false,
    },
};

@Injectable()
export class MasterExportService {
    private readonly datasetDefinitions: MasterExportDatasetDefinition[] = [
        {
            key: 'assessments',
            label: 'Assessments',
            description: 'Assessment assignments, lifecycle metadata, origins, status, activation and expiration dates.',
            source: 'POSTGRES_MONGO',
            sensitivity: 'CLINICAL',
            supportedProcessingModes: [
                processingModes.raw,
                processingModes.processedLong,
                processingModes.processedWide,
            ],
            filters: [filters.dateRange, filters.department, filters.role],
            requiredPermissions: [
                PermissionEnum.ASSESSMENTS_VIEW_ASSIGNED,
                PermissionEnum.ASSESSMENTS_VIEW_DEPARTMENT,
                PermissionEnum.ASSESSMENTS_VIEW_ALL,
            ],
        },
        {
            key: 'assessment_responses',
            label: 'Assessment responses',
            description: 'Questionnaire answers and derived export tables for research analysis.',
            source: 'MONGO_POSTGRES',
            sensitivity: 'CLINICAL_HIGH',
            supportedProcessingModes: [
                processingModes.raw,
                processingModes.processedLong,
                processingModes.processedWide,
            ],
            filters: [filters.dateRange, filters.department, filters.role],
            requiredPermissions: [
                PermissionEnum.ASSESSMENTS_VIEW_ASSIGNED,
                PermissionEnum.ASSESSMENTS_VIEW_DEPARTMENT,
                PermissionEnum.ASSESSMENTS_VIEW_ALL,
            ],
        },
        {
            key: 'patients',
            label: 'Patients',
            description: 'Patient profile, departments, case managers, caregivers, status and clinical cycle metadata.',
            source: 'POSTGRES',
            sensitivity: 'CLINICAL',
            supportedProcessingModes: [processingModes.raw, processingModes.processedLong],
            filters: [filters.dateRange, filters.department],
            requiredPermissions: [
                PermissionEnum.PATIENTS_VIEW_ASSIGNED,
                PermissionEnum.PATIENTS_VIEW_DEPARTMENT,
                PermissionEnum.PATIENTS_VIEW_ALL,
            ],
        },
        {
            key: 'users',
            label: 'Users',
            description: 'User profiles, roles, departments, status and account metadata.',
            source: 'POSTGRES',
            sensitivity: 'ADMINISTRATIVE',
            supportedProcessingModes: [processingModes.raw, processingModes.processedLong],
            filters: [filters.dateRange, filters.department, filters.role],
            requiredPermissions: [
                PermissionEnum.USERS_VIEW_DEPARTMENT,
                PermissionEnum.USERS_VIEW_DEPARTMENT_HIERARCHY,
                PermissionEnum.USERS_VIEW_ALL,
            ],
        },
        {
            key: 'clinical_sessions',
            label: 'Clinical sessions',
            description: 'Treatment or supervision sessions, scheduling, modality, cancellation and linked resources.',
            source: 'POSTGRES',
            sensitivity: 'CLINICAL',
            supportedProcessingModes: [processingModes.raw, processingModes.processedLong],
            filters: [filters.dateRange, filters.department, filters.role],
            requiredPermissions: [
                PermissionEnum.CLINICAL_VIEW_ASSIGNED,
                PermissionEnum.CLINICAL_VIEW_DEPARTMENT,
                PermissionEnum.CLINICAL_VIEW_ALL,
            ],
        },
        {
            key: 'informed_consent_responses',
            label: 'Informed consent responses',
            description: 'Informed consent submissions, response history, status, review and reactivation metadata.',
            source: 'POSTGRES',
            sensitivity: 'CLINICAL_ADMINISTRATIVE',
            supportedProcessingModes: [processingModes.raw, processingModes.processedLong],
            filters: [filters.dateRange, filters.department, filters.role],
            requiredPermissions: [
                PermissionEnum.INFORMED_CONSENT_RESPONSES_VIEW_ASSIGNED,
                PermissionEnum.INFORMED_CONSENT_RESPONSES_VIEW_DEPARTMENT,
                PermissionEnum.INFORMED_CONSENT_RESPONSES_VIEW_ALL,
            ],
        },
        {
            key: 'report_sessions',
            label: 'Report usage sessions',
            description: 'Report access audit trail with report, user, patient context, start time, last activity and duration.',
            source: 'POSTGRES',
            sensitivity: 'AUDIT',
            supportedProcessingModes: [processingModes.raw, processingModes.processedLong],
            filters: [filters.dateRange, filters.department, filters.role],
            requiredPermissions: [
                PermissionEnum.REPORTS_EDIT_DEPARTMENT,
                PermissionEnum.REPORTS_EDIT_ALL,
            ],
        },
        {
            key: 'notification_logs',
            label: 'Notification logs',
            description: 'Notification dispatch audit data, recipients, events, channels and delivery status.',
            source: 'POSTGRES',
            sensitivity: 'AUDIT',
            supportedProcessingModes: [processingModes.raw, processingModes.processedLong],
            filters: [filters.dateRange, filters.department, filters.role],
            requiredPermissions: [
                PermissionEnum.NOTIFICATION_LOGS_VIEW_DEPARTMENT,
                PermissionEnum.NOTIFICATION_LOGS_VIEW_ALL,
            ],
        },
        {
            key: 'automation_runs',
            label: 'Automation runs',
            description: 'Applied automation history, triggers, target context and execution metadata.',
            source: 'POSTGRES',
            sensitivity: 'AUDIT_CLINICAL',
            supportedProcessingModes: [processingModes.raw, processingModes.processedLong],
            filters: [filters.dateRange, filters.department, filters.role],
            requiredPermissions: [
                PermissionEnum.AUTOMATIONS_VIEW_DEPARTMENT,
                PermissionEnum.AUTOMATIONS_VIEW_ALL,
            ],
        },
    ];

    async getDatasets(currentUser: User, includeUnavailable = false): Promise<MasterExportDataset[]> {
        const grants = await PermissionService.userPermissionGrants(currentUser.id);
        const datasets = this.datasetDefinitions.map(dataset => ({
            ...dataset,
            available: dataset.requiredPermissions.some(permission =>
                PermissionService.hasPermission(grants, permission),
            ),
        }));

        return includeUnavailable ? datasets : datasets.filter(dataset => dataset.available);
    }

    async getDataset(currentUser: User, key: string): Promise<MasterExportDataset> {
        const datasets = await this.getDatasets(currentUser, true);
        return datasets.find(dataset => dataset.key === key) || null;
    }
}
