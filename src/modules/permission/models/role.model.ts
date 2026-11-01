import { departmentDefinitionFilter } from 'src/shared/department-definition-access';
import { Authorize } from '@nestjs-query/query-graphql';
import { projectDepartments } from 'src/shared/project-resource-access';
import {
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
    BaseEntity,
    Entity,
    ManyToMany,
    JoinTable,
    Column,
    BeforeUpdate,
    BeforeRemove,
    OneToMany,
} from 'typeorm';
import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Permission } from './permission.model';
import { FilterableField, UnPagedRelation } from '@nestjs-query/query-graphql';
import { User } from 'src/modules/user/models/user.model';
import { RoleCode } from '../enums/role-code.enum';
import { MIN_ROLE_HIERARCHY } from '../constants';
import { Report } from 'src/modules/report/models/report.model';

@Authorize<Role>({ authorize: async context => await departmentDefinitionFilter('Role', context) })
@ObjectType()
@UnPagedRelation('permissions', () => Permission, {disableUpdate: true, disableRemove: true})
@UnPagedRelation('users', () => User, { disableUpdate: true, disableRemove: true, auth: { authorize: async context => {
    const ids = await projectDepartments(context.req.user.id);
    return ids ? { departments: { id: { in: ids.length ? ids : [0] } } } : {};
} } })
@Entity()
export class Role extends BaseEntity {
    @Field(() => [Int], { nullable: true })
    @Column('simple-json', { nullable: true })
    departmentIds?: number[];

    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField()
    @Column()
    name: string;

    @FilterableField({ nullable: true })
    @Column({ nullable: true, unique: true })
    code: RoleCode;

    @FilterableField()
    @Column({ default: MIN_ROLE_HIERARCHY })
    hierarchy: number;

    @FilterableField()
    @CreateDateColumn()
    createdAt?: Date;

    @FilterableField()
    @UpdateDateColumn()
    updatedAt?: Date;

    @Field({ nullable: true })
    @DeleteDateColumn()
    deletedAt?: Date;

    @ManyToMany(
        () => Permission,
        permission => permission.roles,
        { onDelete: 'CASCADE' },
    )
    @JoinTable({ name: 'role_permission' })
    permissions: Permission[];

    @ManyToMany(
        () => User,
        user => user.roles,
    )
    users: User[];

    @Field()
    get isSuperAdmin(): boolean {
        return this.code === RoleCode.SUPER_ADMIN;
    }

    @Field()
    get isPatient(): boolean {
        return this.code === RoleCode.PATIENT;
    }

    @Field()
    get isCaregiver(): boolean {
        return this.code === RoleCode.CAREGIVER;
    }

    @Field()
    get isTherapist(): boolean {
        return this.code === RoleCode.THERAPIST;
    }

    @Field()
    get isSupervisor(): boolean {
        return this.code === RoleCode.SUPERVISOR;
    }

    @Field()
    get isNoRole(): boolean {
        return this.code === RoleCode.NO_ROLE;
    }

    @BeforeUpdate()
    beforeUpdate() {
        if (this.isSuperAdmin || this.isPatient || this.isCaregiver || 
            this.isTherapist || this.isSupervisor || 
            [RoleCode.DEPARTMENT_ADMIN, RoleCode.RESEARCH_ADMIN, RoleCode.PROJECT_RESEARCHER].includes(this.code))
            throw new Error('Cannot update system roles');
    }

    @BeforeRemove()
    beforeDelete() {
        if (this.isSuperAdmin || this.isPatient || this.isCaregiver || 
            this.isTherapist || this.isSupervisor || 
            [RoleCode.DEPARTMENT_ADMIN, RoleCode.RESEARCH_ADMIN, RoleCode.PROJECT_RESEARCHER].includes(this.code))
            throw new Error('Cannot delete system roles');
    }

    @ManyToMany(
        () => Report,
        report => report.roles,
    )
    reports: Report[];
}
