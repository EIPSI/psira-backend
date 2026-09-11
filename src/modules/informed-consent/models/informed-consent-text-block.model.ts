import { FilterableField, FilterableRelation } from '@nestjs-query/query-graphql';
import { Field, Int, ObjectType } from '@nestjs/graphql';
import {
    BaseEntity,
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { InformedConsentVersion } from './informed-consent-version.model';

@ObjectType()
@FilterableRelation('version', () => InformedConsentVersion)
@Entity()
export class InformedConsentTextBlock extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => Int)
    @Column()
    versionId: number;

    @FilterableField(() => Int)
    @Column()
    orderIndex: number;

    @Field({ nullable: true })
    @Column({ nullable: true })
    title?: string;

    @Field()
    @Column({ type: 'text' })
    content: string;

    @Field(() => InformedConsentVersion)
    @ManyToOne(() => InformedConsentVersion, version => version.textBlocks, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'versionId' })
    version: InformedConsentVersion;
}
