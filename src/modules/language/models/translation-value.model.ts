import { FilterableField, FilterableRelation } from '@nestjs-query/query-graphql';
import { Field, Int, ObjectType } from '@nestjs/graphql';
import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
    Unique,
    UpdateDateColumn,
    JoinColumn,
} from 'typeorm';
import { User } from 'src/modules/user/models/user.model';
import { Language } from './language.model';
import { TranslationKey } from './translation-key.model';

@ObjectType()
@FilterableRelation('language', () => Language)
@FilterableRelation('translationKey', () => TranslationKey)
@Entity()
@Unique('UQ_translation_value_language_key', ['languageId', 'key'])
export class TranslationValue extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => Int)
    @Column()
    languageId: number;

    @FilterableField()
    @Column()
    languageCode: string;

    @FilterableField()
    @Column()
    key: string;

    @Field({ nullable: true })
    @Column({ nullable: true, type: 'text' })
    value?: string;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    updatedById?: number;

    @Field(() => Language)
    @ManyToOne(() => Language, language => language.values, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'languageId' })
    language: Language;

    @Field(() => TranslationKey)
    @ManyToOne(() => TranslationKey, key => key.values, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'key', referencedColumnName: 'key' })
    translationKey: TranslationKey;

    @Field(() => User, { nullable: true })
    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'updatedById' })
    updatedBy?: User;

    @FilterableField()
    @CreateDateColumn()
    createdAt: Date;

    @FilterableField()
    @UpdateDateColumn()
    updatedAt: Date;
}
