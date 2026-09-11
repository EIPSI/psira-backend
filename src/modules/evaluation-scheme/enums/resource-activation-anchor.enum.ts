import { registerEnumType } from '@nestjs/graphql';

export enum ResourceActivationAnchor {
    SESSION_START = 'SESSION_START',
    SESSION_END = 'SESSION_END',
}

registerEnumType(ResourceActivationAnchor, {
    name: 'ResourceActivationAnchor',
});
