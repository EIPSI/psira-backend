import { FilterableField, FilterableRelation } from '@nestjs-query/query-graphql';
import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import { Patient } from 'src/modules/patient/models/patient.model';
import { User } from 'src/modules/user/models/user.model';
import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { AssignmentRequestKind } from '../enums/assignment-request-kind.enum';
import { AssignmentRequestStatus } from '../enums/assignment-request-status.enum';

@ObjectType()
@FilterableRelation('patient', () => Patient, { nullable: true })
@FilterableRelation('therapist', () => User, { nullable: true })
@FilterableRelation('assignee', () => User)
@FilterableRelation('requester', () => User)
@Entity()
export class AssignmentRequest extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => AssignmentRequestKind)
    @Column({ type: 'varchar' })
    kind: AssignmentRequestKind;

    @FilterableField(() => AssignmentRequestStatus)
    @Column({ type: 'varchar', default: AssignmentRequestStatus.PENDING })
    status: AssignmentRequestStatus;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    patientId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    therapistId?: number;

    @FilterableField(() => Int)
    @Column()
    assigneeId: number;

    @FilterableField(() => Int)
    @Column()
    requesterId: number;

    @FilterableField(() => GraphQLISODateTime, { nullable: true })
    @Column({ nullable: true })
    respondedAt?: Date;

    @FilterableField(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @FilterableField(() => GraphQLISODateTime)
    @UpdateDateColumn()
    updatedAt: Date;

    @Field(() => Patient, { nullable: true })
    @ManyToOne(() => Patient, { nullable: true, onDelete: 'CASCADE' })
    patient?: Patient;

    @Field(() => User, { nullable: true })
    @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
    therapist?: User;

    @Field(() => User)
    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    assignee: User;

    @Field(() => User)
    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    requester: User;
}
