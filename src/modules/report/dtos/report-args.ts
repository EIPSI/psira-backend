import { Type } from 'class-transformer';
import { ArrayMaxSize, IsOptional, ValidateNested } from 'class-validator';
import { TableSortInput } from 'src/shared/query/table-sorting';
import { Field } from '@nestjs/graphql';
import { QueryArgsType, QueryOptions } from '@nestjs-query/query-graphql';
import { ArgsType } from '@nestjs/graphql';
import { Report } from '../models/report.model';

@ArgsType()
export class ReportQuery extends QueryArgsType(Report) {
    @Field(() => [TableSortInput], { nullable: true })
    @IsOptional()
    @ArrayMaxSize(20)
    @ValidateNested({ each: true })
    @Type(() => TableSortInput)
    tableSorting?: TableSortInput[];
}

export const ReportQueryConnection = ReportQuery.ConnectionType;
