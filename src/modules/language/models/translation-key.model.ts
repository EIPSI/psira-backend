import { FilterableField } from '@nestjs-query/query-graphql';
import { Field, ObjectType } from '@nestjs/graphql';
import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    PrimaryColumn,
    UpdateDateColumn,
} from 'typeorm';
import { TranslationValue } from './translation-value.model';

@ObjectType()
@Entity()
export class TranslationKey extends BaseEntity {
    @FilterableField()
    @PrimaryColumn()
    key: string;

    @FilterableField()
    @Column()
    namespace: string;

    @Field({ nullable: true })
    @Column({ nullable: true, type: 'text' })
    defaultText?: string;

    @Field({ nullable: true })
    @Column({ nullable: true, type: 'text' })
    description?: string;

    @Field(() => [String], { nullable: true })
    @Column({ type: 'simple-array', nullable: true })
    variables?: string[];

    @FilterableField()
    @Column({ default: true })
    isSystem: boolean;

    @Field(() => [TranslationValue], { nullable: true })
    @OneToMany(() => TranslationValue, value => value.translationKey)
    values?: TranslationValue[];

    @FilterableField()
    @CreateDateColumn()
    createdAt: Date;

    @FilterableField()
    @UpdateDateColumn()
    updatedAt: Date;
}
