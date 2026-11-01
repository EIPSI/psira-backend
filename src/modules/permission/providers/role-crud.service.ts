import { QueryService } from '@nestjs-query/core';
import { TypeOrmQueryService } from '@nestjs-query/query-typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Department } from 'src/modules/department/models/department.model';
import { RoleCode } from '../enums/role-code.enum';
import { DeepPartial, In, Repository } from 'typeorm';
import { Role } from '../models/role.model';

@QueryService(Role)
export class RoleCrudService extends TypeOrmQueryService<Role> {
    async createOne(input: DeepPartial<Role>): Promise<Role> {
        return Role.getRepository().manager.transaction(async manager => {
            const roles = manager.getRepository(Role);
            const role = await roles.save(roles.create({ ...input,
                code: input.code || (`CUSTOM_${randomBytes(12).toString('hex').toUpperCase()}` as RoleCode),
            }));
            if (role.departmentIds?.length) {
                const departments = manager.getRepository(Department);
                const rows = await departments.find({ where: { id: In(role.departmentIds) } });
                for (const row of rows) {
                    if (row.appliedRoleCodes?.length && !row.appliedRoleCodes.includes(role.code)) {
                        row.appliedRoleCodes = [...row.appliedRoleCodes, role.code];
                        await departments.save(row);
                    }
                }
            }
            return role;
        });
    }

    constructor(@InjectRepository(Role) repo: Repository<Role>) {
        // pass the use soft delete option to the service.
        super(repo, { useSoftDelete: true });
    }
}
