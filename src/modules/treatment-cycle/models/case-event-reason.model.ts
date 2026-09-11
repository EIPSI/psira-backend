/* eslint-disable @typescript-eslint/no-use-before-define */
import {
    FilterableField,
    FilterableRelation,
    FilterableUnPagedRelation,
} from '@nestjs-query/query-graphql';
import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import { Department } from 'src/modules/department/models/department.model';
import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { CaseEventReasonContext } from '../enums/case-event-reason-context.enum';

@ObjectType()
@FilterableRelation('department', () => Department, { nullable: true })
@FilterableRelation('parent', () => CaseEventReason, { nullable: true })
@FilterableUnPagedRelation('children', () => CaseEventReason, { nullable: true })
@Entity()
export class CaseEventReason extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => CaseEventReasonContext)
    @Column({ type: 'enum', enum: CaseEventReasonContext, enumName: 'case_event_reason_context_enum' })
    context: CaseEventReasonContext;

    @FilterableField()
    @Column()
    label: string;

    @FilterableField({ nullable: true })
    @Column({ nullable: true })
    nextLevelLabel?: string;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    parentId?: number | null;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    departmentId?: number | null;

    @FilterableField()
    @Column({ default: true })
    active: boolean;

    @FilterableField()
    @Column({ default: false })
    isOther: boolean;

    @FilterableField(() => Int)
    @Column({ default: 0 })
    sortOrder: number;

    @Field(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @Field(() => GraphQLISODateTime)
    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => Department, { nullable: true })
    @JoinColumn({ name: 'departmentId' })
    department?: Department;

    @ManyToOne(
        () => CaseEventReason,
        reason => reason.children,
        { nullable: true },
    )
    parent?: CaseEventReason;

    @OneToMany(
        () => CaseEventReason,
        reason => reason.parent,
    )
    children?: CaseEventReason[];
}
