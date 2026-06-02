import {
    FilterableField,
    FilterableRelation,
    FilterableUnPagedRelation,
} from '@nestjs-query/query-graphql';
import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import { AssessmentType } from 'src/modules/assessment/models/assessment-type.model';
import { Department } from 'src/modules/department/models/department.model';
import { EvaluationScheme } from 'src/modules/evaluation-scheme/models/evaluation-scheme.model';
import { MailTemplate } from 'src/modules/mail/models/mail-template.model';
import { Role } from 'src/modules/permission/models/role.model';
import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    JoinTable,
    ManyToMany,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { EvaluationAutomationConditionDto } from '../dtos/evaluation-automation-condition.dto';
import { EvaluationAutomationDelayUnit } from '../enums/evaluation-automation-delay-unit.enum';
import { EvaluationAutomationTriggerPoint } from '../enums/evaluation-automation-trigger-point.enum';
import { EvaluationAutomationType } from '../enums/evaluation-automation-type.enum';
import { EvaluationAutomationRun } from './evaluation-automation-run.model';

@ObjectType()
@FilterableUnPagedRelation('departments', () => Department, { nullable: true })
@FilterableRelation('role', () => Role)
@FilterableRelation('scheme', () => EvaluationScheme, { nullable: true })
@FilterableRelation('assessmentType', () => AssessmentType, { nullable: true })
@FilterableRelation('mailTemplate', () => MailTemplate, { nullable: true })
@FilterableUnPagedRelation('runs', () => EvaluationAutomationRun, { nullable: true })
@Entity()
export class EvaluationAutomation extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField()
    @Column()
    title: string;

    @FilterableField({ nullable: true })
    @Column({ nullable: true })
    description?: string;

    @FilterableField()
    @Column({ default: true })
    active: boolean;

    @FilterableField(() => Int)
    @Column()
    roleId: number;

    @Field(() => [EvaluationAutomationConditionDto], { nullable: true })
    @Column({ type: 'simple-json', nullable: true })
    conditions?: EvaluationAutomationConditionDto[];

    @FilterableField(() => EvaluationAutomationTriggerPoint)
    @Column({ type: 'enum', enum: EvaluationAutomationTriggerPoint })
    triggerPoint: EvaluationAutomationTriggerPoint;

    @FilterableField(() => EvaluationAutomationType)
    @Column({ type: 'enum', enum: EvaluationAutomationType })
    automationType: EvaluationAutomationType;

    @FilterableField(() => Int)
    @Column()
    delayAmount: number;

    @FilterableField(() => EvaluationAutomationDelayUnit)
    @Column({ type: 'enum', enum: EvaluationAutomationDelayUnit })
    delayUnit: EvaluationAutomationDelayUnit;

    @FilterableField(() => Int)
    @Column({ default: 100 })
    priority: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    schemeId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    assessmentTypeId?: number;

    @Field(() => [String], { nullable: true })
    @Column({ type: 'simple-json', nullable: true })
    questionnaireIds?: string[];

    @Field(() => [String], { nullable: true })
    @Column({ type: 'simple-json', nullable: true })
    questionnaireBundleIds?: string[];

    @Field(() => [Int], { nullable: true })
    @Column({ type: 'simple-json', nullable: true })
    randomizationRuleIds?: number[];

    @FilterableField({ nullable: true })
    @Column({ nullable: true })
    evaluationName?: string;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    expirationMinutes?: number;

    @Field(() => [Int], { nullable: true })
    @Column({ type: 'simple-json', nullable: true })
    reminderMinutes?: number[];

    @FilterableField()
    @Column({ default: true })
    emailNotificationsEnabled: boolean;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    mailTemplateId?: number;

    @FilterableField(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @FilterableField(() => GraphQLISODateTime)
    @UpdateDateColumn()
    updatedAt: Date;

    @Field(() => [Department], { nullable: true })
    @ManyToMany(() => Department)
    @JoinTable({
        name: 'evaluation_automation_department',
        joinColumn: { name: 'automationId', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'departmentId', referencedColumnName: 'id' },
    })
    departments: Department[];

    @Field(() => Role)
    @ManyToOne(() => Role)
    role: Role;

    @Field(() => EvaluationScheme, { nullable: true })
    @ManyToOne(() => EvaluationScheme, { nullable: true })
    scheme?: EvaluationScheme;

    @Field(() => AssessmentType, { nullable: true })
    @ManyToOne(() => AssessmentType, { nullable: true })
    assessmentType?: AssessmentType;

    @Field(() => MailTemplate, { nullable: true })
    @ManyToOne(() => MailTemplate, { nullable: true })
    mailTemplate?: MailTemplate;

    @Field(() => [EvaluationAutomationRun], { nullable: true })
    @OneToMany(
        () => EvaluationAutomationRun,
        run => run.automation,
    )
    runs: EvaluationAutomationRun[];
}
