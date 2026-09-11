import { FilterableField, FilterableRelation, FilterableUnPagedRelation } from '@nestjs-query/query-graphql';
import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import { Department } from 'src/modules/department/models/department.model';
import { Role } from 'src/modules/permission/models/role.model';
import { User } from 'src/modules/user/models/user.model';
import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    JoinTable,
    ManyToMany,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { InformedConsentManagementStatus } from '../enums/informed-consent-management-status.enum';
import { InformedConsentTrigger } from '../enums/informed-consent-trigger.enum';
import { InformedConsentModel } from './informed-consent-model.model';

@ObjectType()
@FilterableRelation('model', () => InformedConsentModel)
@FilterableUnPagedRelation('departments', () => Department, { nullable: true })
@FilterableUnPagedRelation('roles', () => Role, { nullable: true })
@Entity()
export class InformedConsentManagement extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField()
    @Column()
    title: string;

    @Field({ nullable: true })
    @Column({ type: 'text', nullable: true })
    description?: string;

    @FilterableField(() => Int)
    @Column()
    modelId: number;

    @FilterableField(() => InformedConsentManagementStatus)
    @Column({ type: 'varchar', default: InformedConsentManagementStatus.DRAFT })
    status: InformedConsentManagementStatus;

    @FilterableField(() => InformedConsentTrigger)
    @Column({ type: 'varchar' })
    trigger: InformedConsentTrigger;

    @FilterableField()
    @Column({ default: true })
    mandatory: boolean;

    @FilterableField()
    @Column({ default: true })
    appliesToAllDepartments: boolean;

    @FilterableField()
    @Column({ default: true })
    appliesToAllRoles: boolean;

    @Column({ type: 'jsonb', nullable: true })
    profileConditions?: any;

    @Field({ nullable: true })
    @Column({ nullable: true })
    scopeHash?: string;

    @FilterableField(() => Int)
    @Column({ default: 100 })
    priority: number;

    @FilterableField()
    @Column({ default: true })
    active: boolean;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    createdById?: number;

    @FilterableField(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @FilterableField(() => GraphQLISODateTime)
    @UpdateDateColumn()
    updatedAt: Date;

    @Field(() => InformedConsentModel)
    @ManyToOne(() => InformedConsentModel, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'modelId' })
    model: InformedConsentModel;

    @Field(() => [Department], { nullable: true })
    @ManyToMany(() => Department)
    @JoinTable({
        name: 'informed_consent_management_department',
        joinColumn: { name: 'managementId', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'departmentId', referencedColumnName: 'id' },
    })
    departments?: Department[];

    @Field(() => [Role], { nullable: true })
    @ManyToMany(() => Role)
    @JoinTable({
        name: 'informed_consent_management_role',
        joinColumn: { name: 'managementId', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'roleId', referencedColumnName: 'id' },
    })
    roles?: Role[];

    @Field(() => User, { nullable: true })
    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'createdById' })
    createdBy?: User;
}
