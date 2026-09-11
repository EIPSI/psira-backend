import { FilterableField } from '@nestjs-query/query-graphql';
import { Field, Int, ObjectType } from '@nestjs/graphql';
import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
    Unique,
    UpdateDateColumn,
} from 'typeorm';
import { TranslationValue } from './translation-value.model';

@ObjectType()
@Entity()
@Unique('UQ_language_code', ['code'])
export class Language extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField()
    @Column()
    code: string;

    @FilterableField()
    @Column()
    name: string;

    @FilterableField({ nullable: true })
    @Column({ nullable: true })
    nativeName?: string;

    @FilterableField()
    @Column({ default: true })
    active: boolean;

    @FilterableField()
    @Column({ default: false })
    isDefault: boolean;

    @FilterableField({ nullable: true })
    @Column({ nullable: true })
    fallbackCode?: string;

    @Field(() => [TranslationValue], { nullable: true })
    @OneToMany(() => TranslationValue, value => value.language)
    values?: TranslationValue[];

    @FilterableField()
    @CreateDateColumn()
    createdAt: Date;

    @FilterableField()
    @UpdateDateColumn()
    updatedAt: Date;
}
