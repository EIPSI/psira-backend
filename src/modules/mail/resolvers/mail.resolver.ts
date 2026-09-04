import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from 'src/modules/auth/auth-user.decorator';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import { PermissionGuard } from 'src/modules/permission/guards/permission.guard';
import {
    CreateEmailTemplate,
    UpdateEmailTemplate,
} from '../dtos/mail-template.dto';
import { MailTemplate } from '../models/mail-template.model';
import { MailTemplateService } from '../services/mail-template.service';
import {
    MailTemplateConnection,
    MailTemplateQuery,
} from '../dtos/mail-template.query';
import { ConnectionType } from '@nestjs-query/query-graphql';
import { SendMailService } from '../services/send-mail.service';
import {
    UseOrPermissions,
    UsePermission,
} from 'src/modules/permission/decorators/permission.decorator';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { User } from 'src/modules/user/models/user.model';

@Resolver(() => MailTemplate)
@UseGuards(GqlAuthGuard, PermissionGuard)
export class MailResolver {
    constructor(
        private readonly mailService: MailTemplateService,
        private readonly sendMailService: SendMailService,
    ) {}

    @Query(() => MailTemplate)
    @UsePermission(PermissionEnum.MAIL_TEMPLATES_VIEW_DEPARTMENT)
    async getEmailTemplate(
        @Args('id', { type: () => ID }) id: number,
        @CurrentUser() currentUser: User,
    ): Promise<MailTemplate> {
        return await this.mailService.getEmailTemplate(id, currentUser);
    }

    @Query(() => MailTemplateConnection)
    @UsePermission(PermissionEnum.MAIL_TEMPLATES_VIEW_DEPARTMENT)
    async getAllEmailTemplates(
        @Args({ type: () => MailTemplateQuery }) query: MailTemplateQuery,
        @Args('departmentIds', { type: () => [Int], nullable: true })
        departmentIds: number[],
        @CurrentUser() currentUser: User,
    ): Promise<ConnectionType<MailTemplate>> {
        return this.mailService.getAllEmailTemplates(query, currentUser, departmentIds);
    }

    @Query(() => [MailTemplate])
    async getPatientEmailTemplates(
        @Args('patientId', { type: () => ID, nullable: true, defaultValue: null }) patientId: number,
    ): Promise<MailTemplate[]> {
        return this.mailService.getPatientEmailTemplates(patientId);
    }

    @Mutation(() => Boolean)
    @UseOrPermissions([
        PermissionEnum.NOTIFICATIONS_EDIT_ALL,
        PermissionEnum.NOTIFICATIONS_EDIT_DEPARTMENT,
        PermissionEnum.MAIL_TEMPLATES_EDIT_ALL,
        PermissionEnum.MAIL_TEMPLATES_EDIT_DEPARTMENT,
    ])
    async sendAssessmentEmail(
        @Args('assessmentId', { type: () => ID }) assessmentId: number,
    ) {
        return this.sendMailService.sendAssessmentEmail(assessmentId);
    }

    @Mutation(() => MailTemplate)
    @UsePermission(PermissionEnum.MAIL_TEMPLATES_EDIT_DEPARTMENT)
    async createEmailTemplate(
        @Args('input') input: CreateEmailTemplate,
        @CurrentUser() currentUser: User,
    ): Promise<MailTemplate> {
        return this.mailService.createEmailTemplate(input, currentUser);
    }

    @Mutation(() => Boolean)
    @UsePermission(PermissionEnum.MAIL_TEMPLATES_DELETE_DEPARTMENT)
    async deleteEmailTemplate(@Args('id') templateId: number) {
        return this.mailService.deleteEmailTemplate(templateId);
    }

    @Mutation(() => MailTemplate)
    @UsePermission(PermissionEnum.MAIL_TEMPLATES_EDIT_DEPARTMENT)
    async updateEmailTemplate(
        @Args('input') input: UpdateEmailTemplate,
        @CurrentUser() currentUser: User,
    ): Promise<MailTemplate> {
        return this.mailService.updateEmailTemplate(input, currentUser);
    }
}
