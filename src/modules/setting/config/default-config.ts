import { SettingDto } from '../dtos/setting.dto';

export const defaultConfig: SettingDto = {
    systemLocale: 'en',
    systemTimezone: 'Africa/Dar_es_Salaam',
    dateFormat: 'YYYY-MM-DD',
    timeFormat: 'LT',
    dateTimeFormat: 'YYYY-MM-DD LT',
    passwordLifeTimeInDays: 365,
    passwordReUseCutoffInDays: 365,
    evaluationAutomationRunRetentionDays: 365,
    treatmentFinalizationUndoWindowDays: 30,
    patientCaseManagerAssignableHierarchyRank: 500,
    maxLoginAttempts: 5,
    googleCalendarEnabled: false,
    notificationsEnabled: true,
    informedConsentEnabled: true,
    googleCalendarClientId: '',
    googleCalendarClientSecret: '',
    googleCalendarRedirectUri: '',
};
