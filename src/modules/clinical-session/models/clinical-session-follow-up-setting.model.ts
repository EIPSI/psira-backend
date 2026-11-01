import { Department } from 'src/modules/department/models/department.model';
import { FilterableField } from '@nestjs-query/query-graphql';
import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import {
    BaseEntity,
    Column,
    Entity,
    PrimaryGeneratedColumn,
    ManyToOne,
    JoinColumn,
    UpdateDateColumn,
} from 'typeorm';

@ObjectType()
@Entity()
export class ClinicalSessionFollowUpSetting extends BaseEntity {
    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @Field(() => Int, { nullable: true })
    @Column({ nullable: true, unique: true })
    departmentId?: number;

    @ManyToOne(() => Department, { nullable: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'departmentId' })
    department?: Department;

    @Field(() => [String], { nullable: true })
    @Column('simple-json', { nullable: true })
    patientCaseManagerRoleCodes?: string[];

    @Field(() => [String], { nullable: true })
    @Column('simple-json', { nullable: true })
    therapistSupervisorRoleCodes?: string[];

    @Field(() => Int)
    @Column({ default: 7 })
    editWindowDays: number;

    @Field(() => Int)
    @Column({ default: 1 })
    dashboardLookaheadDays: number;

    @Field(() => GraphQLISODateTime)
    @UpdateDateColumn()
    updatedAt: Date;
}
