import { Type } from 'class-transformer';
import { ArrayMaxSize, IsOptional, ValidateNested } from 'class-validator';
import { TableSortInput } from 'src/shared/query/table-sorting';
import { Field } from '@nestjs/graphql';
import { QueryArgsType } from '@nestjs-query/query-graphql';
import { ArgsType } from '@nestjs/graphql';
import { MailTemplate } from '../models/mail-template.model';

@ArgsType()
export class MailTemplateQuery extends QueryArgsType(MailTemplate) {
    @Field(() => [TableSortInput], { nullable: true })
    @IsOptional()
    @ArrayMaxSize(20)
    @ValidateNested({ each: true })
    @Type(() => TableSortInput)
    tableSorting?: TableSortInput[];
}

export const MailTemplateConnection = MailTemplateQuery.ConnectionType;