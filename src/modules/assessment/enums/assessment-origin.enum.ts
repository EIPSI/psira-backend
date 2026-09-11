import { registerEnumType } from '@nestjs/graphql';

export enum AssessmentOrigin {
    INDIVIDUAL = 'INDIVIDUAL',
    FIXED_SCHEME = 'FIXED_SCHEME',
    SESSION_BASED = 'SESSION_BASED',
}

registerEnumType(AssessmentOrigin, {
    name: 'AssessmentOrigin',
});
