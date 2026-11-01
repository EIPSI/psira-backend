import { projectDepartments } from 'src/shared/project-resource-access';
import { departmentDefinitionFilter } from 'src/shared/department-definition-access';
import { Authorize } from '@nestjs-query/query-graphql';
import { FilterableField, UnPagedRelation } from '@nestjs-query/query-graphql';
import { Field, Int, ObjectType } from '@nestjs/graphql';
import {
    BaseEntity,
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { Patient } from './patient.model';

@Authorize<PatientStatus>({ authorize: async context => await departmentDefinitionFilter('PatientStatus', context) })
@ObjectType()
@UnPagedRelation('patients', () => Patient, {
    auth: { authorize: async context => {
        const ids = await projectDepartments(context.req.user.id);
        return ids ? { departments: { id: { in: ids.length ? ids : [0] } } } : {};
    } },
    nullable: true,
    disableUpdate: true,
    disableRemove: true,
})
@Entity()
export class PatientStatus extends BaseEntity {
    @Field(() => [Int], { nullable: true })
    @Column('simple-json', { nullable: true })
    departmentIds?: number[];

    @FilterableField(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @FilterableField()
    @Column()
    name: string;

    @FilterableField({ nullable: true })
    @Column({ nullable: true })
    description: string;

    @FilterableField()
    @CreateDateColumn()
    createdAt: Date;

    @FilterableField()
    @UpdateDateColumn()
    updatedAt: Date;

    @Field({ nullable: true })
    @DeleteDateColumn()
    deletedAt?: Date;

    @OneToMany(
        () => Patient,
        patient => patient.status,
    )
    patients: Patient[];
}
