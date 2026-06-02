import { registerEnumType } from '@nestjs/graphql';

export enum EvaluationAutomationResourceType {
    EVALUATION_SCHEME_ASSIGNMENT = 'EVALUATION_SCHEME_ASSIGNMENT',
    ASSESSMENT = 'ASSESSMENT',
}

registerEnumType(EvaluationAutomationResourceType, {
    name: 'EvaluationAutomationResourceType',
});
