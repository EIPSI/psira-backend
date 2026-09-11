// Run with Node and TypeScript available; no database connection is made.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const ts = require(process.env.PSIRA_TYPESCRIPT_PATH || 'typescript');
const file = process.argv[2] || 'src/modules/notification/resolvers/master-export-notification-log.resolver.ts';
const source = fs.readFileSync(file, 'utf8');
const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017,
    experimentalDecorators: true, emitDecoratorMetadata: true,
} }).outputText;
const all = 'notificationLogs.view.all';
const department = 'notificationLogs.view.department';
let grants = [], recorded, decorators = [];
const decorator = (...args) => { decorators.push(args); return () => {}; };
const query = {
    where(sql, args) { recorded.after = args.afterId; return this; },
    orderBy(field, direction) { recorded.order = [field, direction]; return this; },
    take(limit) { recorded.limit = limit; return this; },
    andWhere(sql, args) { recorded.scope = { sql, args }; return this; },
    async getMany() { return []; },
};
const mocks = {
    '@nestjs/common': { UseGuards: decorator },
    '@nestjs/graphql': { Args: decorator, Query: decorator, Resolver: decorator, Int: Number },
    'src/modules/auth/auth-user.decorator': { CurrentUser: decorator },
    'src/modules/auth/auth.guard': { GqlAuthGuard: class {} },
    'src/modules/permission/decorators/permission.decorator': { UseOrPermissions: decorator },
    'src/modules/permission/enums/permission.enum': { PermissionEnum: {
        NOTIFICATION_LOGS_VIEW_ALL: all, NOTIFICATION_LOGS_VIEW_DEPARTMENT: department,
    } },
    'src/modules/permission/guards/permission.guard': { PermissionGuard: class {} },
    'src/modules/permission/providers/permission.service': { PermissionService: {
        async userPermissionGrants(id) { assert.strictEqual(id, 7); return grants; },
        hasPermission(values, permission) { return values.includes(permission); },
    } },
    'src/modules/user/models/user.model': { User: class {} },
    '../models/notification-log.model': { NotificationLog: {
        createQueryBuilder() { recorded = {}; return query; },
    } },
};
const exportsObject = {};
vm.runInNewContext(output, { exports: exportsObject, require(name) {
    assert(name in mocks, `Unexpected import ${name}`); return mocks[name];
} });
(async () => {
    const resolver = new exportsObject.MasterExportNotificationLogResolver();
    grants = [all];
    await resolver.masterExportNotificationLogs({ id: 7 }, 30, 900);
    assert.strictEqual(recorded.after, 30);
    assert.strictEqual(recorded.limit, 500);
    assert.strictEqual(recorded.scope, undefined);
    assert.deepStrictEqual(recorded.order, ['log.id', 'ASC']);
    grants = [department];
    await resolver.masterExportNotificationLogs({ id: 7 }, -1, 0);
    assert.strictEqual(recorded.after, 0);
    assert.strictEqual(recorded.limit, 1);
    assert.strictEqual(recorded.scope.args.viewerId, 7);
    assert(recorded.scope.sql.includes('recipient_department."userId" = log."recipientId"'));
    assert(recorded.scope.sql.includes('viewer_department."departmentId" = recipient_department."departmentId"'));
    assert(decorators.some(args => Array.isArray(args[0]) && args[0].includes(all) && args[0].includes(department)));
    console.log('NOTIFICATION_EXPORT_CHECKS_OK (10 assertions)');
})().catch(error => { console.error(error); process.exitCode = 1; });
