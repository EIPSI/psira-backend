import { registerEnumType } from '@nestjs/graphql';

export enum MailTemplatePurposeEnum {
    NOTIFICATION = 'NOTIFICATION',
    WELCOME = 'WELCOME',
}

registerEnumType(MailTemplatePurposeEnum, { name: 'MailTemplatePurpose' });
