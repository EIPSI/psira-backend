import { ConnectionType } from '@nestjs-query/query-graphql';
import {
    Injectable,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import {
    CreateEmailTemplate,
    UpdateEmailTemplate,
} from '../dtos/mail-template.dto';
import {
    MailTemplateConnection,
    MailTemplateQuery,
} from '../dtos/mail-template.query';
import { MailTemplate } from '../models/mail-template.model';
import {
    applyQuery,
    SortDirection,
} from '@nestjs-query/core';
import { Department } from 'src/modules/department/models/department.model';
import { Patient } from 'src/modules/patient/models/patient.model';
import { AssessmentTypeEnum } from 'src/modules/assessment/enums/assessment-type.enum';
import { User } from 'src/modules/user/models/user.model';
import { PermissionService } from 'src/modules/permission/providers/permission.service';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { uniqueDepartmentIds } from 'src/shared/department-compatibility';

enum DepartmentAccessScope {
    ALL = 'ALL',
    INSTITUTION = 'INSTITUTION',
}

@Injectable()
export class MailTemplateService {
    constructor(
        @InjectRepository(MailTemplate)
        private mailTemplateRepository: Repository<MailTemplate>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly permissionService: PermissionService,
    ) {}

    async getEmailTemplate(id: number, currentUser: User): Promise<MailTemplate> {
        const mailTemplate = await this.mailTemplateRepository.findOneOrFail(id, {
            relations: ['departments'],
        });

        if (!await this.canAccessTemplate(mailTemplate, currentUser)) {
            throw new ForbiddenException('Cannot access this email template');
        }

        return mailTemplate;
    }

    async getPatientEmailTemplates(patientId: number) {
        if (!patientId) {
            return [];
        }

        const patient = await Patient.findOneOrFail({
            where: { id: patientId },
            relations: ['departments'],
        });

        const mailTemplates = await this.mailTemplateRepository
            .createQueryBuilder('mailTemplate')
            .leftJoinAndSelect('mailTemplate.departments', 'department')
            .where('mailTemplate.status = :status', {
                status: AssessmentTypeEnum.ACTIVE,
            })
            .andWhere(
                new Brackets(subQb => {
                    const patientDepartmentIds = patient.departments.map(
                        department => department.id,
                    );
                    if (patientDepartmentIds.length) {
                        subQb.where('department.id IN(:...ids)', {
                            ids: patientDepartmentIds,
                        });
                    } else {
                        subQb.where('1 = 0');
                    }
                    subQb.orWhere('mailTemplate.isPublic = true');
                    subQb.orWhere('department.id IS NULL');
                }),
            )
            .getMany();

        return mailTemplates;
    }

    async getAllEmailTemplates(
        query: MailTemplateQuery,
        currentUser: User,
        departmentIds: number[] = [],
    ): Promise<ConnectionType<MailTemplate>> {
        query.sorting = query.sorting?.length
            ? query.sorting
            : [{ field: 'id', direction: SortDirection.DESC }];

        const result: any = await MailTemplateConnection.createFromPromise(
            q => this.listEmailTemplates(q, currentUser, departmentIds),
            query,
        );

        return result;
    }

    async createEmailTemplate(
        input: CreateEmailTemplate,
        currentUser: User,
    ): Promise<MailTemplate> {
        const { departmentIds = [], ...restInput } = input;
        const selectedDepartmentIds = uniqueDepartmentIds(departmentIds);
        const isPublic = restInput.isPublic || !selectedDepartmentIds.length;
        await this.validateDepartmentAccess(currentUser, selectedDepartmentIds);

        try {
            const mail = this.mailTemplateRepository.create({
                ...restInput,
                isPublic,
            });

            const departments: any = isPublic
                ? []
                : await Department.find({
                    where: selectedDepartmentIds.map(id => ({ id })),
                });

            mail.departments = departments;

            return this.mailTemplateRepository.save(mail);
        } catch (error) {
            throw error;
        }
    }

    async deleteEmailTemplate(templateId: number) {
        try {
            const template = await this.mailTemplateRepository.findOne(
                templateId,
            );

            if (!template) {
                throw new NotFoundException('Mail template not found!');
            }

            await this.mailTemplateRepository.delete(templateId);
            return true;
        } catch (error) {
            throw error;
        }
    }

    async updateEmailTemplate(
        input: UpdateEmailTemplate,
        currentUser: User,
    ): Promise<MailTemplate> {
        const { id, departmentIds = [], ...values } = input;
        const selectedDepartmentIds = uniqueDepartmentIds(departmentIds);
        const isPublic = values.isPublic || !selectedDepartmentIds.length;

        try {
            const mailTemplate = await this.mailTemplateRepository.findOne({
                where: {
                    id,
                },
                relations: ['departments'],
            });

            if (!mailTemplate) {
                throw new NotFoundException('Mail template not found!');
            }

            if (!await this.canAccessTemplate(mailTemplate, currentUser)) {
                throw new ForbiddenException('Cannot update this email template');
            }

            await this.validateDepartmentAccess(currentUser, selectedDepartmentIds);

            for (const [key, value] of Object.entries(values)) {
                mailTemplate[key] = value;
            }
            mailTemplate.isPublic = isPublic;

            let departments: any = [];

            if (!isPublic) {
                departments = await Department.find({
                    where: selectedDepartmentIds.map(id => ({ id })),
                });
            }

            mailTemplate.departments = departments;

            return mailTemplate.save();
        } catch (error) {
            throw error;
        }
    }

    private async listEmailTemplates(
        query: MailTemplateQuery,
        currentUser: User,
        departmentIds: number[] = [],
    ): Promise<MailTemplate[]> {
        const access = await this.getUserDepartmentAccess(currentUser.id);
        const explicitDepartmentIds = uniqueDepartmentIds(departmentIds);

        const qb = this.mailTemplateRepository
            .createQueryBuilder('mailTemplate')
            .leftJoinAndSelect('mailTemplate.departments', 'department');

        if (access.scope !== DepartmentAccessScope.ALL) {
            const accessDepartmentIds = access.departmentIds || [];
            qb.andWhere(new Brackets(subQb => {
                subQb.where('mailTemplate.isPublic = true');
                subQb.orWhere('department.id IS NULL');
                if (accessDepartmentIds.length) {
                    subQb.orWhere('department.id IN (:...accessDepartmentIds)', {
                        accessDepartmentIds,
                    });
                }
            }));
        }

        if (explicitDepartmentIds.length) {
            qb.andWhere(new Brackets(subQb => {
                subQb.where('mailTemplate.isPublic = true');
                subQb.orWhere('department.id IS NULL');
                subQb.orWhere('department.id IN (:...explicitDepartmentIds)', {
                    explicitDepartmentIds,
                });
            }));
        }

        const templates = await qb.getMany();
        return applyQuery(templates, query);
    }

    private async canAccessTemplate(mailTemplate: MailTemplate, currentUser: User): Promise<boolean> {
        const access = await this.getUserDepartmentAccess(currentUser.id);
        if (access.scope === DepartmentAccessScope.ALL) return true;
        if (mailTemplate.isPublic || !mailTemplate.departments?.length) return true;

        const accessDepartmentIds = access.departmentIds || [];
        return mailTemplate.departments.some(department =>
            accessDepartmentIds.includes(department.id),
        );
    }

    private async validateDepartmentAccess(currentUser: User, departmentIds: number[]): Promise<void> {
        if (!departmentIds.length) return;

        const departmentsCount = await Department.count({
            where: departmentIds.map(id => ({ id })),
        });
        if (departmentsCount !== departmentIds.length) {
            throw new NotFoundException('One of the departments does not exist');
        }

        const access = await this.getUserDepartmentAccess(currentUser.id);
        if (access.scope === DepartmentAccessScope.ALL) return;

        const accessDepartmentIds = access.departmentIds || [];
        if (!departmentIds.every(id => accessDepartmentIds.includes(id))) {
            throw new ForbiddenException('Cannot assign email template to these departments');
        }
    }

    private async getUserDepartmentAccess(userId: number): Promise<{ scope: DepartmentAccessScope; departmentIds?: number[] }> {
        if (
            await this.permissionService.userCan(userId, PermissionEnum.MANAGE_USERS) ||
            await this.permissionService.userCan(userId, PermissionEnum.ASSIGN_ANY_ASSESSMENT_USER)
        ) {
            return { scope: DepartmentAccessScope.ALL };
        }

        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ['departments'],
        });

        return {
            scope: DepartmentAccessScope.INSTITUTION,
            departmentIds: user?.departments?.map(department => department.id) || [],
        };
    }
}
