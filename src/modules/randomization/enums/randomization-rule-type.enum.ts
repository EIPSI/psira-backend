import { registerEnumType } from '@nestjs/graphql';

export enum RandomizationRuleType {
    LOW_LEVEL = 'LOW_LEVEL',
    HIGH_LEVEL = 'HIGH_LEVEL',
}

registerEnumType(RandomizationRuleType, {
    name: 'RandomizationRuleType',
});
