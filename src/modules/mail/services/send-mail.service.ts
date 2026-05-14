import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Assessment } from 'src/modules/assessment/models/assessment.model';
import { Repository } from 'typeorm';
import { AssessmentEmailStatus } from 'src/modules/assessment/enums/assessment-emailstatus.enum';
import Handlebars from 'handlebars';
import * as CryptoJS from 'crypto-js';
import { url } from '../../../shared';
import { configService } from 'src/config/config.service';
import { QuestionnaireAssessmentService } from 'src/modules/questionnaire/services/questionnaire-assessment.service';
import { AssessmentStatus } from 'src/modules/questionnaire/enums/assessment-status.enum';
import { User } from 'src/modules/user/models/user.model';
import { MailTemplate } from '../models/mail-template.model';
import { AssessmentTypeEnum } from 'src/modules/assessment/enums/assessment-type.enum';
import { TemplateModuleEnum } from '../enums/template-module.enum';
import { SettingService } from 'src/modules/setting/providers/setting.service';
import { SettingKey } from 'src/modules/setting/enums/setting-name.enum';

@Injectable()
export class SendMailService {
    constructor(
        private questionnaireAssessmentService: QuestionnaireAssessmentService,
        private mailerService: MailerService,
        private settingService: SettingService,
        @InjectRepository(Assessment)
        private assessmentRepository: Repository<Assessment>,
    ) {}

    @Cron(CronExpression.EVERY_MINUTE)
    async checkAssessmentEmails() {
        try {
            const selectAssessment = await this.assessmentRepository
                .createQueryBuilder('assessment')
                .leftJoinAndSelect('assessment.mailTemplate', 'mailTemplate')
                .where(
                    `(Extract(epoch FROM (assessment.deliveryDate - now()))/60)::integer <= 0 
                    AND assessment.emailStatus = 'SCHEDULED'`,
                )
                .getMany();

            selectAssessment.map(async assessmentInfo => {
                await this.sendEmail(assessmentInfo);
            });
        } catch (error) {
            return error;
        }
    }

    async sendAssessmentEmail(id: number) {
        try {
            const assessment = await this.assessmentRepository.findOneOrFail({
                where: { id },
                relations: ['mailTemplate'],
            });

            if (!assessment.mailTemplate) {
                throw new Error('Mail template not found!');
            }

            if (!assessment.emailReminder || !assessment.receiverEmail) {
                throw new Error('Email is required!');
            }

            await this.sendEmail(assessment);
            return true;
        } catch (error) {
            return error;
        }
    }

    async sendEmail(assessmentInfo: Assessment) {
        const mailTemplate = assessmentInfo.mailTemplate;

        const questionnaireAssessment = await this.questionnaireAssessmentService.getById(
            assessmentInfo.questionnaireAssessmentId.toString(),
        );

        if (
            questionnaireAssessment.status === AssessmentStatus.CANCELLED ||
            (assessmentInfo.expirationDate && new Date(assessmentInfo.expirationDate) < new Date()) ||
            assessmentInfo.deleted ||
            !mailTemplate
        ) {
            return await this.assessmentRepository.update(assessmentInfo.id, {
                emailStatus: AssessmentEmailStatus.FAILED,
            });
        }

        Handlebars.registerHelper('helperMissing', function(val) {
            if (val === undefined) {
                return null;
            }
            return val;
        });

        const template = Handlebars.compile(mailTemplate.body);

        const url = this.generateAssessmentURL(assessmentInfo.uuid);

        const templateData = {
            // name: assessmentInfo.patient.firstName,
            link: url,
        };

        await this.mailerService
            .sendMail({
                to: assessmentInfo.receiverEmail,
                from: configService.getSenderMail(),
                subject: mailTemplate.subject,
                html: template(templateData),
            })
            .then(async () => {
                await this.assessmentRepository.update(assessmentInfo.id, {
                    emailStatus: AssessmentEmailStatus.SENT,
                });
            })
            .catch(async () => {
                await this.assessmentRepository.update(assessmentInfo.id, {
                    emailStatus: AssessmentEmailStatus.FAILED,
                });
            });
    }

    private generateAssessmentURL(assesmentUuid: string): string {
        const secretKey = configService.getFrontendEncryptionKey();

        const cryptoId = CryptoJS.AES.encrypt(
            assesmentUuid,
            secretKey,
        ).toString();

        return url(
            `assessment/overview?assessment=${encodeURIComponent(cryptoId)}`,
        );
    }

    /**
     * Send welcome email to new patients/caregivers with temporary credentials
     */
    async sendWelcomeEmail(user: User, tempPassword: string): Promise<boolean> {
        try {
            const enabled = await this.settingService.getKey(
                SettingKey.SEND_WELCOME_EMAILS,
            );

            if (String(enabled) === 'false' || !user.email) {
                return true;
            }

            const mailTemplate = await this.getWelcomeEmailTemplate();

            if (!mailTemplate) {
                console.error('Welcome email template not found');
                return false;
            }

            const templateFn = Handlebars.compile(mailTemplate.body);
            const html = templateFn({
                firstName: user.firstName,
                lastName: user.lastName,
                fullName: [user.firstName, user.lastName].filter(Boolean).join(' '),
                username: user.username,
                password: tempPassword,
                loginUrl: this.getLoginUrl(),
            });

            await this.mailerService.sendMail({
                to: user.email,
                from: configService.getSenderMail(),
                subject: mailTemplate.subject,
                html: html,
            });

            console.log(`Welcome email sent to ${user.email}`);
            return true;
        } catch (error) {
            console.error('Error sending welcome email:', error);
            return false;
        }
    }

    private async getWelcomeEmailTemplate(): Promise<MailTemplate | null> {
        const configuredTemplateId = await this.settingService.getKey(
            SettingKey.WELCOME_EMAIL_TEMPLATE_ID,
        );

        if (configuredTemplateId) {
            const configuredTemplate = await MailTemplate.findOne({
                where: {
                    id: configuredTemplateId,
                    status: AssessmentTypeEnum.ACTIVE,
                },
            });

            if (configuredTemplate) {
                return configuredTemplate;
            }
        }

        return MailTemplate.findOne({
            where: {
                module: TemplateModuleEnum.WELCOME,
                status: AssessmentTypeEnum.ACTIVE,
            },
            order: {
                id: 'ASC',
            },
        });
    }

    private getLoginUrl(): string {
        return `${configService.getAppUrl().replace(/\/$/, '')}/auth/login`;
    }
}
