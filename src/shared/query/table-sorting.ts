import { Field, InputType } from '@nestjs/graphql';
import { BadRequestException } from '@nestjs/common';
import { IsIn, IsString } from 'class-validator';
import { Query } from '@nestjs-query/core';
import { FilterQueryBuilder } from '@nestjs-query/query-typeorm/dist/src/query/filter-query.builder';
import { Repository } from 'typeorm';

@InputType()
export class TableSortInput {
    @Field()
    @IsString()
    field: string;

    @Field()
    @IsIn(['ASC', 'DESC'])
    direction: 'ASC' | 'DESC';
}

// Expressions come from server-owned maps. Client field names never become SQL.
export function tableQueryBuilder<T>(
    repository: Repository<T>, query: Query<T>, sorting: TableSortInput[] = [],
    expressions: Record<string, (alias: string) => string> = {},
) {
    const factory = new FilterQueryBuilder(repository);
    const builder = factory.select({ ...query, sorting: sorting.length ? [] : query.sorting });
    for (const [index, sort] of sorting.entries()) {
        if (!['ASC', 'DESC'].includes(sort.direction)) throw new BadRequestException('Invalid sort direction');
        const column = repository.metadata.columns.find(item => item.propertyName === sort.field);
        const customExpression = Object.prototype.hasOwnProperty.call(expressions, sort.field)
            ? expressions[sort.field](builder.alias) : undefined;
        const expression = customExpression ||
            (column && `"${builder.alias}"."${column.databaseName}"`);
        if (!expression) throw new BadRequestException(`Unsupported sort field: ${sort.field}`);
        const sortAlias = `table_sort_${index}`;
        builder.addSelect(expression, sortAlias).addOrderBy(sortAlias, sort.direction, 'NULLS LAST');
    }
    if (sorting.length) builder.addOrderBy(`"${builder.alias}".id`, 'ASC');
    return builder;
}
