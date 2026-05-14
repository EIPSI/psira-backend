import { registerEnumType } from '@nestjs/graphql';

export enum TemplateModuleEnum {
    ASSESSMENT = 'ASSESSMENT',
    CLIENT = 'CLIENT',
    WELCOME = 'WELCOME',
}

registerEnumType(TemplateModuleEnum, { name: 'TemplateModule' });
