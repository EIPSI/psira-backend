import {
    FilterableField,
    FilterableUnPagedRelation,
} from '@nestjs-query/query-graphql';
import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import { Department } from 'src/modules/department/models/department.model';
import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    JoinTable,
    ManyToMany,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { EvaluationSchemeType } from '../enums/evaluation-scheme-type.enum';
import { EvaluationSchemeAssignment } from './evaluation-scheme-assignment.model';
import { IndependentEvaluationTemplate } from './independent-evaluation-template.model';
import { SchemeSessionTemplate } from './scheme-session-template.model';

@ObjectType()
@FilterableUnPagedRelation('departments', () => Department, { nullable: true })
@FilterableUnPagedRelation('assignments', () => EvaluationSchemeAssignment, { nullable: true })
@FilterableUnPagedRelation('sessionTemplates', () => SchemeSessionTemplate, { nullable: true })
@FilterableUnPagedRelation('independentEvaluationTemplates', () => IndependentEvaluationTemplate, { nullable: true })
@Entity()
export class EvaluationScheme extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField()
    @Column()
    name: string;

    @Field({ nullable: true })
    @Column({ nullable: true })
    description?: string;

    @FilterableField(() => EvaluationSchemeType)
    @Column({ type: 'enum', enum: EvaluationSchemeType })
    schemeType: EvaluationSchemeType;

    @Field({ nullable: true })
    @Column({ nullable: true })
    defaultRecurrenceRule?: string;

    @FilterableField(() => Int)
    @Column({ default: 60 })
    defaultDurationMinutes: number;

    @FilterableField(() => Int)
    @Column({ default: 7 })
    durationDays: number;

    @FilterableField()
    @Column({ default: true })
    active: boolean;

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

    @ManyToMany(() => Department)
    @JoinTable({ name: 'evaluation_scheme_department' })
    departments: Department[];

    @OneToMany(
        () => EvaluationSchemeAssignment,
        assignment => assignment.scheme,
    )
    assignments: EvaluationSchemeAssignment[];

    @OneToMany(
        () => SchemeSessionTemplate,
        sessionTemplate => sessionTemplate.scheme,
    )
    sessionTemplates: SchemeSessionTemplate[];

    @OneToMany(
        () => IndependentEvaluationTemplate,
        evaluationTemplate => evaluationTemplate.scheme,
    )
    independentEvaluationTemplates: IndependentEvaluationTemplate[];
}
