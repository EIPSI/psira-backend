import { FilterableField, FilterableRelation } from '@nestjs-query/query-graphql';
import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Department } from 'src/modules/department/models/department.model';
import { MailTemplate } from 'src/modules/mail/models/mail-template.model';
import { Role } from 'src/modules/permission/models/role.model';
import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
    Unique,
    UpdateDateColumn,
} from 'typeorm';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { NotificationEvent } from '../enums/notification-event.enum';
import { NotificationFamily } from '../enums/notification-family.enum';

@ObjectType()
@FilterableRelation('department', () => Department, { nullable: true })
@FilterableRelation('recipientRole', () => Role)
@FilterableRelation('mailTemplate', () => MailTemplate, { nullable: true })
@Entity()
@Unique('UQ_notification_configuration_scope', [
    'departmentId',
    'channel',
    'event',
    'recipientRoleId',
])
export class NotificationConfiguration extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    departmentId?: number;

    @FilterableField(() => NotificationChannel)
    @Column({ type: 'enum', enum: NotificationChannel })
    channel: NotificationChannel;

    @FilterableField(() => NotificationFamily)
    @Column({ type: 'enum', enum: NotificationFamily })
    family: NotificationFamily;

    @FilterableField(() => NotificationEvent)
    @Column({ type: 'enum', enum: NotificationEvent })
    event: NotificationEvent;

    @FilterableField(() => Int)
    @Column()
    recipientRoleId: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    mailTemplateId?: number;

    @FilterableField()
    @Column({ default: true })
    active: boolean;

    @Field({ nullable: true })
    @Column({ nullable: true })
    notes?: string;

    @FilterableField()
    @CreateDateColumn()
    createdAt: Date;

    @FilterableField()
    @UpdateDateColumn()
    updatedAt: Date;

    @Field(() => Department, { nullable: true })
    @ManyToOne(() => Department, { nullable: true })
    department?: Department;

    @Field(() => Role)
    @ManyToOne(() => Role)
    recipientRole: Role;

    @Field(() => MailTemplate, { nullable: true })
    @ManyToOne(() => MailTemplate, { nullable: true })
    mailTemplate?: MailTemplate;
}
