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
import { MAX_ROLE_HIERARCHY } from '../constants';
import { Report } from 'src/modules/report/models/report.model';

@ObjectType()
@UnPagedRelation('permissions', () => Permission, {disableUpdate: true, disableRemove: true})
@UnPagedRelation('users', () => User)
@Entity()
export class Role extends BaseEntity {
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
    @Column({ default: MAX_ROLE_HIERARCHY })
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
        if (this.isSuperAdmin || this.isPatient || this.isCaregiver || this.isTherapist || this.isSupervisor)
            throw new Error('Cannot update system roles');
    }

    @BeforeRemove()
    beforeDelete() {
        if (this.isSuperAdmin || this.isPatient || this.isCaregiver || this.isTherapist || this.isSupervisor)
            throw new Error('Cannot delete system roles');
    }

    @ManyToMany(
        () => Report,
        report => report.roles,
    )
    reports: Report[];
}
