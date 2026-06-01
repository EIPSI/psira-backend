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
import { RandomizationRuleType } from '../enums/randomization-rule-type.enum';
import { RandomizationRuleItem } from './randomization-rule-item.model';

@ObjectType()
@FilterableUnPagedRelation('departments', () => Department, { nullable: true })
@FilterableUnPagedRelation('items', () => RandomizationRuleItem, { nullable: true })
@Entity()
export class RandomizationRule extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField()
    @Column()
    name: string;

    @FilterableField(() => RandomizationRuleType)
    @Column({ type: 'enum', enum: RandomizationRuleType })
    type: RandomizationRuleType;

    @FilterableField()
    @Column({ default: true })
    active: boolean;

    @Field(() => Int)
    get itemCount(): number {
        return this.items?.length || 0;
    }

    @FilterableField(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @FilterableField(() => GraphQLISODateTime)
    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToMany(() => Department)
    @JoinTable({ name: 'randomization_rule_department' })
    departments: Department[];

    @OneToMany(
        () => RandomizationRuleItem,
        item => item.randomizationRule,
        { cascade: true },
    )
    items: RandomizationRuleItem[];
}
