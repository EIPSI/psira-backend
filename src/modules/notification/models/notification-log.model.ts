import { FilterableField, FilterableRelation } from '@nestjs-query/query-graphql';
import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import { MailTemplate } from 'src/modules/mail/models/mail-template.model';
import { User } from 'src/modules/user/models/user.model';
import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { NotificationEvent } from '../enums/notification-event.enum';
import { NotificationLogStatus } from '../enums/notification-log-status.enum';

@ObjectType()
@FilterableRelation('recipient', () => User, { nullable: true })
@FilterableRelation('mailTemplate', () => MailTemplate, { nullable: true })
@Entity()
export class NotificationLog extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => NotificationChannel)
    @Column({ type: 'enum', enum: NotificationChannel })
    channel: NotificationChannel;

    @FilterableField(() => NotificationEvent)
    @Column({ type: 'enum', enum: NotificationEvent })
    event: NotificationEvent;

    @FilterableField(() => NotificationLogStatus)
    @Column({ type: 'enum', enum: NotificationLogStatus })
    status: NotificationLogStatus;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    notificationConfigurationId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    recipientId?: number;

    @FilterableField({ nullable: true })
    @Column({ nullable: true })
    recipientEmail?: string;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    mailTemplateId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    assessmentId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    patientId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    therapistId?: number;

    @Field({ nullable: true })
    @Column({ nullable: true })
    subject?: string;

    @Field({ nullable: true })
    @Column({ nullable: true })
    message?: string;

    @Column({ type: 'simple-json', nullable: true })
    metadata?: Record<string, any>;

    @FilterableField(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @Field(() => User, { nullable: true })
    @ManyToOne(() => User, { nullable: true })
    recipient?: User;

    @Field(() => MailTemplate, { nullable: true })
    @ManyToOne(() => MailTemplate, { nullable: true })
    mailTemplate?: MailTemplate;
}
