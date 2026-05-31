import {
    FilterableField,
    FilterableRelation,
    FilterableUnPagedRelation,
} from '@nestjs-query/query-graphql';
import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import { ClinicalSessionKind } from 'src/modules/clinical-session/enums/clinical-session-kind.enum';
import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { EvaluationScheme } from './evaluation-scheme.model';
import { SchemeResourceTemplate } from './scheme-resource-template.model';

@ObjectType()
@FilterableRelation('scheme', () => EvaluationScheme)
@FilterableUnPagedRelation('resourceTemplates', () => SchemeResourceTemplate, { nullable: true })
@Entity()
export class SchemeSessionTemplate extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => Int)
    @Column()
    schemeId: number;

    @FilterableField(() => ClinicalSessionKind)
    @Column({ type: 'enum', enum: ClinicalSessionKind })
    sessionKind: ClinicalSessionKind;

    @FilterableField(() => Int)
    @Column()
    sessionIndex: number;

    @FilterableField()
    @Column()
    title: string;

    @Field(() => Int)
    @Column({ default: 0 })
    relativeOffsetDays: number;

    @Field(() => Int)
    @Column({ default: 60 })
    durationMinutes: number;

    @FilterableField(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @FilterableField(() => GraphQLISODateTime)
    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => EvaluationScheme, scheme => scheme.sessionTemplates)
    scheme: EvaluationScheme;

    @OneToMany(
        () => SchemeResourceTemplate,
        resourceTemplate => resourceTemplate.sessionTemplate,
    )
    resourceTemplates: SchemeResourceTemplate[];
}
