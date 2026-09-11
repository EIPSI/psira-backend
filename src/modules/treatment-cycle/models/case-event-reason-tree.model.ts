import { FilterableField, FilterableRelation } from '@nestjs-query/query-graphql';
import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import { Department } from 'src/modules/department/models/department.model';
import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { CaseEventReasonContext } from '../enums/case-event-reason-context.enum';

@ObjectType()
@FilterableRelation('department', () => Department, { nullable: true })
@Entity()
export class CaseEventReasonTree extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => CaseEventReasonContext)
    @Column({ type: 'enum', enum: CaseEventReasonContext, enumName: 'case_event_reason_context_enum' })
    context: CaseEventReasonContext;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    departmentId?: number | null;

    @FilterableField()
    @Column({ default: true })
    active: boolean;

    @Field(() => [String], { nullable: true })
    @Column({ type: 'simple-json', nullable: true })
    levelLabels?: string[];

    @Field(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @Field(() => GraphQLISODateTime)
    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => Department, { nullable: true })
    @JoinColumn({ name: 'departmentId' })
    department?: Department;
}
