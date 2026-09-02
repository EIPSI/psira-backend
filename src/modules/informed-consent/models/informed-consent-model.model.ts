import { FilterableField, FilterableUnPagedRelation } from '@nestjs-query/query-graphql';
import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import { Department } from 'src/modules/department/models/department.model';
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
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { InformedConsentKind } from '../enums/informed-consent-kind.enum';
import { InformedConsentVersion } from './informed-consent-version.model';

@ObjectType()
@FilterableUnPagedRelation('departments', () => Department, { nullable: true })
@FilterableUnPagedRelation('versions', () => InformedConsentVersion, { nullable: true })
@Entity()
export class InformedConsentModel extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField()
    @Column()
    name: string;

    @FilterableField(() => InformedConsentKind)
    @Column({ type: 'varchar' })
    kind: InformedConsentKind;

    @Field({ nullable: true })
    @Column({ type: 'text', nullable: true })
    description?: string;

    @FilterableField()
    @Column({ default: true })
    active: boolean;

    @FilterableField()
    @Column({ default: false })
    systemDefault: boolean;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    currentPublishedVersionId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    createdById?: number;

    @FilterableField(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @FilterableField(() => GraphQLISODateTime)
    @UpdateDateColumn()
    updatedAt: Date;

    @Field(() => [Department], { nullable: true })
    @ManyToMany(() => Department)
    @JoinTable({
        name: 'informed_consent_model_department',
        joinColumn: { name: 'modelId', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'departmentId', referencedColumnName: 'id' },
    })
    departments?: Department[];

    @Field(() => [InformedConsentVersion], { nullable: true })
    @OneToMany(() => InformedConsentVersion, version => version.model)
    versions?: InformedConsentVersion[];

    @Field(() => InformedConsentVersion, { nullable: true })
    @ManyToOne(() => InformedConsentVersion, { nullable: true })
    @JoinColumn({ name: 'currentPublishedVersionId' })
    currentPublishedVersion?: InformedConsentVersion;

    @Field(() => User, { nullable: true })
    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'createdById' })
    createdBy?: User;
}
