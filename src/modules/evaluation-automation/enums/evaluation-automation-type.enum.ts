import { registerEnumType } from '@nestjs/graphql';

export enum EvaluationAutomationType {
    FIXED_SCHEME = 'FIXED_SCHEME',
    INDIVIDUAL_EVALUATION = 'INDIVIDUAL_EVALUATION',
}

registerEnumType(EvaluationAutomationType, {
    name: 'EvaluationAutomationType',
});
