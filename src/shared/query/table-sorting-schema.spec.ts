jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
import { Args, Int, Query, Resolver, GraphQLSchemaBuilderModule, GraphQLSchemaFactory } from '@nestjs/graphql';
import { NestFactory } from '@nestjs/core';
import { QueryArgsType } from '@nestjs-query/query-graphql';
import { ReportQuery } from '../../modules/report/dtos/report-args';
import { AssessmentQuery } from '../../modules/assessment/dtos/assessment.query';
import { MailTemplateQuery } from '../../modules/mail/dtos/mail-template.query';
import { Department } from '../../modules/department/models/department.model';
import { printSchema } from 'graphql';
import { writeFileSync } from 'fs';

const DepartmentQuery = QueryArgsType(Department);
@Resolver()
class SortingSchemaResolver {
    @Query(() => ReportQuery.ConnectionType)
    reports(@Args({ type: () => ReportQuery }) args: ReportQuery) { return args; }
    @Query(() => AssessmentQuery.ConnectionType)
    assessments(@Args({ type: () => AssessmentQuery }) args: AssessmentQuery) { return args; }
    @Query(() => MailTemplateQuery.ConnectionType)
    getAllEmailTemplates(@Args({ type: () => MailTemplateQuery }) args: MailTemplateQuery,
        @Args('departmentIds', { type: () => [Int], nullable: true }) departmentIds?: number[]) { return args; }
    @Query(() => DepartmentQuery.ConnectionType)
    departments(@Args({ type: () => DepartmentQuery }) args) { return args; }
}
it('exposes computed ordering and department role columns in the actual GraphQL schema', async () => {
    const app = await NestFactory.createApplicationContext(GraphQLSchemaBuilderModule, { logger: false });
    try {
        const schema = await app.get(GraphQLSchemaFactory).create([SortingSchemaResolver]);
        const text = printSchema(schema);
        expect(text).toContain('input TableSortInput');
        expect(text.match(/tableSorting: \[TableSortInput!\]/g)).toHaveLength(3);
        const fields = schema.getType('DepartmentSortFields') as any;
        expect(fields.getValues().map(value => value.name)).toEqual(expect.arrayContaining(['appliedRoleCodes', 'defaultRoleCodes']));
        if (process.env.PSIRA_SORT_SCHEMA_PATH) writeFileSync(process.env.PSIRA_SORT_SCHEMA_PATH, text);
    } finally { await app.close(); }
}, 30000);
