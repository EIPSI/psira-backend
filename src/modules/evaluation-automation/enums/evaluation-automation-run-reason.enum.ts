import { registerEnumType } from '@nestjs/graphql';

export enum EvaluationAutomationRunReason {
    CONDITIONS_NOT_MET = 'conditions_not_met',
    DUPLICATE_DETECTED = 'duplicate_detected',
    AUTOMATION_INACTIVE = 'automation_inactive',
    MISSING_REQUIRED_DATA = 'missing_required_data',
    INVALID_ROLE = 'invalid_role',
    INVALID_DEPARTMENT = 'invalid_department',
    RESOURCE_NOT_FOUND = 'resource_not_found',
    EXECUTION_ERROR = 'execution_error',
}

registerEnumType(EvaluationAutomationRunReason, {
    name: 'EvaluationAutomationRunReason',
});
