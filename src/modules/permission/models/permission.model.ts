import { projectDepartments } from 'src/shared/project-resource-access';
import { departmentDefinitionFilter } from 'src/shared/department-definition-access';
import {
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
    BaseEntity,
    Entity,
    ManyToMany,
    Column,
} from 'typeorm';
import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Role } from './role.model';
import { FilterableField, UnPagedRelation } from '@nestjs-query/query-graphql';
import { User } from 'src/modules/user/models/user.model';

@ObjectType()
@UnPagedRelation('roles', () => Role, {
    auth: { authorize: async context => await departmentDefinitionFilter('Role', context) },
    disableRemove: true,
    disableUpdate: true,
})
@UnPagedRelation('users', () => User, {
    auth: { authorize: async context => {
        const ids = await projectDepartments(context.req.user.id);
        return ids ? { departments: { id: { in: ids.length ? ids : [0] } } } : {};
    } },
    disableRemove: true,
    disableUpdate: true,
})
@Entity()
export class Permission extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField()
    @Column()
    name: string;

    @FilterableField()
    @Column({ default: 'default' })
    group: string;

    @FilterableField()
    @CreateDateColumn()
    createdAt: Date;

    @FilterableField()
    @UpdateDateColumn()
    updatedAt: Date;

    @Field({ nullable: true })
    @DeleteDateColumn()
    deletedAt?: Date;

    @ManyToMany(
        () => Role,
        role => role.permissions,
        { onDelete: 'CASCADE' },
    )
    roles: Role[];

    @ManyToMany(
        () => User,
        user => user.permissions,
    )
    users: User[];
}
