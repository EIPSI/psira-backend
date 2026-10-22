jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
import { tableQueryBuilder } from './table-sorting';

describe('Server table ordering', () => {
    function repository() {
        const builder: any = { alias: 'entity' };
        for (const name of ['where', 'andWhere', 'limit', 'offset', 'addSelect', 'addOrderBy']) {
            builder[name] = jest.fn().mockReturnValue(builder);
        }
        const repo: any = {
            createQueryBuilder: jest.fn().mockReturnValue(builder),
            metadata: { name: 'Example', relations: [], columns: [
                { propertyName: 'id', databaseName: 'id' }, { propertyName: 'name', databaseName: 'name' },
            ] },
        };
        return { repo, builder };
    }
    it('orders computed fields in requested priority before fetching a page', () => {
        const { repo, builder } = repository();
        tableQueryBuilder(repo, { paging: { limit: 10, offset: 20 } }, [
            { field: 'roles', direction: 'ASC' }, { field: 'name', direction: 'DESC' },
        ], { roles: () => "(SELECT 'roles')" });
        expect(builder.addSelect.mock.calls).toEqual([
            ["(SELECT 'roles')", 'table_sort_0'], ['"entity"."name"', 'table_sort_1'],
        ]);
        expect(builder.addOrderBy.mock.calls).toEqual([
            ['table_sort_0', 'ASC', 'NULLS LAST'], ['table_sort_1', 'DESC', 'NULLS LAST'], ['"entity".id', 'ASC'],
        ]);
        expect(builder.limit).toHaveBeenCalledWith(10);
        expect(builder.offset).toHaveBeenCalledWith(20);
    });
    it('rejects unrecognized fields and directions instead of interpolating them in SQL', () => {
        for (const sort of [
            { field: 'name; DROP TABLE user', direction: 'ASC' }, { field: 'toString', direction: 'ASC' }, { field: 'name', direction: 'invalid' },
        ]) {
            const { repo } = repository();
            expect(() => tableQueryBuilder(repo, {}, [sort as any])).toThrow();
        }
    });
});
