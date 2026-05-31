import {
    FilterableField,
    FilterableRelation,
    FilterableUnPagedRelation,
} from '@nestjs-query/query-graphql';
import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import { CalendarOccurrence } from 'src/modules/calendar/models/calendar-occurrence.model';
import { SchemeSessionTemplate } from 'src/modules/evaluation-scheme/models/scheme-session-template.model';
import { Patient } from 'src/modules/patient/models/patient.model';
import { User } from 'src/modules/user/models/user.model';
import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
    OneToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { ClinicalSessionKind } from '../enums/clinical-session-kind.enum';
import { ClinicalSessionStatus } from '../enums/clinical-session-status.enum';
import { ClinicalSessionResource } from './clinical-session-resource.model';

@ObjectType()
@FilterableRelation('calendarOccurrence', () => CalendarOccurrence)
@FilterableRelation('sessionTemplate', () => SchemeSessionTemplate, { nullable: true })
@FilterableRelation('patient', () => Patient, { nullable: true })
@FilterableRelation('therapist', () => User, { nullable: true })
@FilterableRelation('supervisor', () => User, { nullable: true })
@FilterableUnPagedRelation('resources', () => ClinicalSessionResource, { nullable: true })
@Entity()
export class ClinicalSession extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField(() => Int)
    @Column()
    calendarOccurrenceId: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    sessionTemplateId?: number;

    @FilterableField(() => ClinicalSessionKind)
    @Column({ type: 'enum', enum: ClinicalSessionKind })
    sessionKind: ClinicalSessionKind;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    sessionNumber?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    patientId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    therapistId?: number;

    @FilterableField(() => Int, { nullable: true })
    @Column({ nullable: true })
    supervisorId?: number;

    @FilterableField(() => ClinicalSessionStatus)
    @Column({
        type: 'enum',
        enum: ClinicalSessionStatus,
        default: ClinicalSessionStatus.SCHEDULED,
    })
    clinicalStatus: ClinicalSessionStatus;

    @Field(() => String, { nullable: true })
    @Column({ type: 'text', nullable: true })
    clinicalHistory?: string;

    @Field(() => String)
    get historyLabel(): string {
        return this.sessionKind === ClinicalSessionKind.SUPERVISION
            ? 'Historial de supervisión'
            : 'Historial clínico';
    }

    @FilterableField(() => GraphQLISODateTime)
    @CreateDateColumn()
    createdAt: Date;

    @FilterableField(() => GraphQLISODateTime)
    @UpdateDateColumn()
    updatedAt: Date;

    @OneToOne(
        () => CalendarOccurrence,
        occurrence => occurrence.clinicalSession,
    )
    @JoinColumn()
    calendarOccurrence: CalendarOccurrence;

    @ManyToOne(() => SchemeSessionTemplate, { nullable: true })
    sessionTemplate?: SchemeSessionTemplate;

    @ManyToOne(() => Patient, { nullable: true })
    patient?: Patient;

    @ManyToOne(() => User, { nullable: true })
    therapist?: User;

    @ManyToOne(() => User, { nullable: true })
    supervisor?: User;

    @OneToMany(() => ClinicalSessionResource, resource => resource.clinicalSession)
    resources: ClinicalSessionResource[];
}
