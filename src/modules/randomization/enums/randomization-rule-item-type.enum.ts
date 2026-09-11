import { registerEnumType } from '@nestjs/graphql';

export enum RandomizationRuleItemType {
    QUESTIONNAIRE = 'QUESTIONNAIRE',
    QUESTIONNAIRE_BUNDLE = 'QUESTIONNAIRE_BUNDLE',
    EVALUATION_SCHEME = 'EVALUATION_SCHEME',
}

registerEnumType(RandomizationRuleItemType, {
    name: 'RandomizationRuleItemType',
});
