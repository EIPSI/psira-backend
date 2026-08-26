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
import { NotificationEvent } from '../enums/notification-event.enum';
import { NotificationPeriodicUnit } from '../enums/notification-periodic-unit.enum';

@ObjectType()
@FilterableRelation('patient', () => Patient, { nullable: true })
@FilterableRelation('therapist', () => User, { nullable: true })
@FilterableRelation('user', () => User, { nullable: true })
@Entity()
export class NotificationPreference extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    patientId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    therapistId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    userId?: number;

    @Field(() => Boolean)
    @Column({ default: true })
    enabled: boolean;

    @Field(() => Boolean)
    @Column({ default: true })
    immediateEnabled: boolean;

    @Field(() => Boolean)
    @Column({ default: false })
    periodicEnabled: boolean;

    @Field(() => Int)
    @Column({ default: 1 })
    periodicEvery: number;

    @Field(() => NotificationPeriodicUnit)
    @Column({
        type: 'enum',
        enum: NotificationPeriodicUnit,
        default: NotificationPeriodicUnit.WEEKS,
    })
    periodicUnit: NotificationPeriodicUnit;

    @Field(() => [NotificationEvent], { nullable: true })
    @Column({ type: 'simple-json', nullable: true })
    enabledEvents?: NotificationEvent[];

    @Field(() => [Int], { nullable: true })
    @Column({ type: 'simple-json', nullable: true })
    excludedRecipientIds?: number[];

    @FilterableField(() => GraphQLISODateTime, { nullable: true })
    @Column({ nullable: true })
    lastPeriodicSentAt?: Date;

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

    @Field(() => User, { nullable: true })
    @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
    user?: User;
}
