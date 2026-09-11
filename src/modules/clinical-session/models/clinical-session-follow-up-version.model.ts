import { FilterableField, FilterableRelation } from '@nestjs-query/query-graphql';
import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import { User } from 'src/modules/user/models/user.model';
import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { ClinicalSession } from './clinical-session.model';

@ObjectType()
@FilterableRelation('clinicalSession', () => ClinicalSession)
@FilterableRelation('editedBy', () => User, { nullable: true })
@Entity()
export class ClinicalSessionFollowUpVersion extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => Int)
    @Column()
    clinicalSessionId: number;

    @Field(() => String, { nullable: true })
    @Column({ type: 'text', nullable: true })
    previousText?: string;

    @Field(() => String, { nullable: true })
    @Column({ type: 'text', nullable: true })
    nextText?: string;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    editedByUserId?: number;

    @FilterableField(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @Field(() => ClinicalSession)
    @ManyToOne(() => ClinicalSession)
    @JoinColumn({ name: 'clinicalSessionId' })
    clinicalSession: ClinicalSession;

    @Field(() => User, { nullable: true })
    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'editedByUserId' })
    editedBy?: User;
}
