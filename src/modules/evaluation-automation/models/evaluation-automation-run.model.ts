import { FilterableField, FilterableRelation } from '@nestjs-query/query-graphql';
import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import { User } from 'src/modules/user/models/user.model';
import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    Index,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { EvaluationAutomationRunReason } from '../enums/evaluation-automation-run-reason.enum';
import { EvaluationAutomationRunStatus } from '../enums/evaluation-automation-run-status.enum';
import { EvaluationAutomationResourceType } from '../enums/evaluation-automation-resource-type.enum';
import { EvaluationAutomationTriggerPoint } from '../enums/evaluation-automation-trigger-point.enum';
import { EvaluationAutomation } from './evaluation-automation.model';

@ObjectType()
@FilterableRelation('automation', () => EvaluationAutomation, { nullable: true })
@FilterableRelation('user', () => User)
@Index(
    'IDX_evaluation_automation_run_unique_event',
    ['automationId', 'userId', 'triggerPoint', 'triggerEventId'],
    { unique: true },
)
@Entity()
export class EvaluationAutomationRun extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    automationId?: number;

    @FilterableField({ nullable: true })
    @Column({ nullable: true })
    automationTitle?: string;

    @FilterableField(() => Int)
    @Column()
    userId: number;

    @FilterableField(() => EvaluationAutomationTriggerPoint)
    @Column({ type: 'enum', enum: EvaluationAutomationTriggerPoint })
    triggerPoint: EvaluationAutomationTriggerPoint;

    @FilterableField()
    @Column()
    triggerEventId: string;

    @FilterableField(() => EvaluationAutomationRunStatus)
    @Column({
        type: 'enum',
        enum: EvaluationAutomationRunStatus,
        default: EvaluationAutomationRunStatus.PENDING,
    })
    status: EvaluationAutomationRunStatus;

    @FilterableField(() => EvaluationAutomationRunReason, { nullable: true })
    @Column({ type: 'enum', enum: EvaluationAutomationRunReason, nullable: true })
    reason?: EvaluationAutomationRunReason;

    @Field({ nullable: true })
    @Column({ nullable: true })
    message?: string;

    @FilterableField(() => EvaluationAutomationResourceType, { nullable: true })
    @Column({ type: 'enum', enum: EvaluationAutomationResourceType, nullable: true })
    resourceType?: EvaluationAutomationResourceType;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    resourceId?: number;

    @Column({ type: 'simple-json', nullable: true })
    metadata?: Record<string, any>;

    @FilterableField(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @FilterableField(() => GraphQLISODateTime)
    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(
        () => EvaluationAutomation,
        automation => automation.runs,
        { nullable: true, onDelete: 'SET NULL' },
    )
    automation?: EvaluationAutomation;

    @ManyToOne(() => User)
    user: User;
}
