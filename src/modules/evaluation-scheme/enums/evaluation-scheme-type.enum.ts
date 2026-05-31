import { registerEnumType } from '@nestjs/graphql';

export enum EvaluationSchemeType {
    SESSION_BASED = 'SESSION_BASED',
    INDEPENDENT_EVALUATION = 'INDEPENDENT_EVALUATION',
}

registerEnumType(EvaluationSchemeType, {
    name: 'EvaluationSchemeType',
});
