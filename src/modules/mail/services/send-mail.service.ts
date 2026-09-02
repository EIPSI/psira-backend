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
import { NotificationDispatchService } from 'src/modules/notification/services/notification-dispatch.service';
import { NotificationChannel } from 'src/modules/notification/enums/notification-channel.enum';
import { NotificationEvent } from 'src/modules/notification/enums/notification-event.enum';
import { NotificationLogStatus } from 'src/modules/notification/enums/notification-log-status.enum';
import { NotificationConfigurationService } from 'src/modules/notification/services/notification-configuration.service';
import { SettingKey } from 'src/modules/setting/enums/setting-name.enum';
import { SettingService } from 'src/modules/setting/providers/setting.service';

@Injectable()
export class SendMailService {
    constructor(
        private questionnaireAssessmentService: QuestionnaireAssessmentService,
        private mailerService: MailerService,
        private notificationDispatchService: NotificationDispatchService,
        private notificationConfigurationService: NotificationConfigurationService,
        private settingService: SettingService,
        @InjectRepository(Assessment)
        private assessmentRepository: Repository<Assessment>,
    ) {}

    @Cron(CronExpression.EVERY_MINUTE)
    async checkAssessmentEmails() {
        try {
            if (!await this.notificationsEnabled()) return;
            await this.schedulePendingAssessmentAssignmentEmails();

            const selectAssessment = await this.assessmentRepository
                .createQueryBuilder('assessment')
                .leftJoinAndSelect('assessment.mailTemplate', 'mailTemplate')
                .leftJoinAndSelect('assessment.patient', 'patient')
                .leftJoinAndSelect('assessment.targetUser', 'targetUser')
                .leftJoinAndSelect('assessment.responderUser', 'responderUser')
                .leftJoinAndSelect('assessment.assessmentType', 'assessmentType')
                .where(
                    `(assessment."deliveryDate" IS NULL
                    OR (Extract(epoch FROM (assessment.deliveryDate - now()))/60)::integer <= 0)
                    AND assessment.emailStatus = 'SCHEDULED'`,
                )
                .getMany();

            selectAssessment.map(async assessmentInfo => {
                await this.sendEmail(assessmentInfo);
            });

            const reminderAssessments = await this.assessmentRepository
                .createQueryBuilder('assessment')
                .leftJoinAndSelect('assessment.mailTemplate', 'mailTemplate')
                .leftJoinAndSelect('assessment.patient', 'patient')
                .leftJoinAndSelect('assessment.targetUser', 'targetUser')
                .leftJoinAndSelect('assessment.responderUser', 'responderUser')
                .leftJoinAndSelect('assessment.assessmentType', 'assessmentType')
                .where('assessment."emailReminder" = true')
                .andWhere('assessment."deliveryDate" IS NOT NULL')
                .andWhere('assessment."reminderMinutes" IS NOT NULL')
                .andWhere('(assessment.deleted = false OR assessment.deleted IS NULL)')
                .andWhere('(assessment."isActive" = true OR assessment."isActive" IS NULL)')
                .andWhere('assessment.status IN (:...reminderStatuses)', {
                    reminderStatuses: [
                        AssessmentStatus.PLANNED,
                        AssessmentStatus.OPEN_FOR_COMPLETION,
                    ],
                })
                .andWhere('(assessment."expirationDate" IS NULL OR assessment."expirationDate" >= now())')
                .getMany();

            await Promise.all(
                reminderAssessments.map(assessmentInfo =>
                    this.sendDueReminderEmails(assessmentInfo),
                ),
            );
        } catch (error) {
            return error;
        }
    }

    private async schedulePendingAssessmentAssignmentEmails() {
        const pendingAssessments = await this.assessmentRepository
            .createQueryBuilder('assessment')
            .leftJoinAndSelect('assessment.responderUser', 'responderUser')
            .where('assessment."receiverEmail" IS NOT NULL')
            .andWhere('assessment."mailTemplateId" IS NULL')
            .andWhere('(assessment."emailStatus" IS NULL OR assessment."emailStatus" = :notScheduled)', {
                notScheduled: AssessmentEmailStatus.NOT_SCHEDULED,
            })
            .andWhere('(assessment.deleted = false OR assessment.deleted IS NULL)')
            .andWhere('assessment.status NOT IN (:...closedStatuses)', {
                closedStatuses: [
                    AssessmentStatus.CANCELLED,
                    AssessmentStatus.COMPLETED,
                    AssessmentStatus.PARTIALLY_COMPLETED,
                ],
            })
            .andWhere('(assessment."expirationDate" IS NULL OR assessment."expirationDate" >= now())')
            .orderBy('COALESCE(assessment."deliveryDate", assessment."createdAt")', 'ASC')
            .limit(200)
            .getMany();

        await Promise.all(
            pendingAssessments.map(async assessment => {
                if (!assessment.responderUserId || !assessment.responderUser) return;

                const mailTemplate = await this.notificationConfigurationService.resolveAssessmentAssignedMailTemplate({
                    responderUserId: assessment.responderUserId,
                    patientId: assessment.patientId,
                    targetUserId: assessment.targetUserId,
                });
                if (!mailTemplate) return;

                await this.assessmentRepository.update(assessment.id, {
                    emailReminder: !!(assessment.reminderMinutes || []).length,
                    emailStatus: AssessmentEmailStatus.SCHEDULED,
                    mailTemplateId: mailTemplate.id,
                    receiverEmail: assessment.responderUser.email || assessment.receiverEmail,
                });
            }),
        );
    }

    async sendAssessmentEmail(id: number) {
        try {
            if (!await this.notificationsEnabled()) return true;
            const assessment = await this.assessmentRepository.findOneOrFail({
                where: { id },
                relations: ['mailTemplate', 'patient', 'targetUser', 'responderUser', 'assessmentType'],
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

    private async sendDueReminderEmails(assessmentInfo: Assessment) {
        const reminderMinutes = assessmentInfo.reminderMinutes || [];
        const sentReminderMinutes = assessmentInfo.sentReminderMinutes || [];
        const deliveryDate = new Date(assessmentInfo.deliveryDate);
        const now = new Date();

        if (!this.canSendAssessmentReminder(assessmentInfo)) {
            return;
        }

        if (!reminderMinutes.length || !assessmentInfo.receiverEmail) {
            return;
        }

        const dueReminderMinutes = reminderMinutes.filter(reminderMinute => {
            const reminderDate = new Date(
                deliveryDate.getTime() + reminderMinute * 60 * 1000,
            );
            return (
                reminderDate <= now &&
                !sentReminderMinutes.includes(reminderMinute)
            );
        });

        for (const reminderMinute of dueReminderMinutes) {
            const mailTemplate = await this.notificationConfigurationService.resolveAssessmentReminderMailTemplate({
                responderUserId: assessmentInfo.responderUserId,
                patientId: assessmentInfo.patientId,
                targetUserId: assessmentInfo.targetUserId,
            });
            if (!mailTemplate) {
                await this.notificationDispatchService.recordLog({
                    channel: NotificationChannel.EMAIL,
                    event: NotificationEvent.ASSESSMENT_REMINDER,
                    status: NotificationLogStatus.SKIPPED_NO_CONFIGURATION,
                    recipientId: assessmentInfo.responderUserId,
                    recipientEmail: assessmentInfo.receiverEmail,
                    assessmentId: assessmentInfo.id,
                    patientId: assessmentInfo.patientId,
                    therapistId: assessmentInfo.targetUserId,
                    message: 'No active notification configuration found for assessment reminder.',
                    metadata: {
                        assessmentId: assessmentInfo.id,
                        reminderMinute,
                    },
                });
                continue;
            }

            const sent = await this.sendEmail(assessmentInfo, {
                event: NotificationEvent.ASSESSMENT_REMINDER,
                mailTemplate,
                updateAssessmentStatus: false,
                metadata: { reminderMinute },
            });
            if (sent) {
                sentReminderMinutes.push(reminderMinute);
                await this.assessmentRepository.update(assessmentInfo.id, {
                    sentReminderMinutes,
                });
            }
        }
    }

    private isAssessmentAnswered(assessmentInfo: Assessment): boolean {
        return (
            !!assessmentInfo.submissionDate ||
            [
                AssessmentStatus.COMPLETED,
                AssessmentStatus.PARTIALLY_COMPLETED,
            ].includes(assessmentInfo.status as AssessmentStatus)
        );
    }

    private canSendAssessmentReminder(assessmentInfo: Assessment): boolean {
        if (this.isAssessmentAnswered(assessmentInfo)) return false;
        if (assessmentInfo.deleted || assessmentInfo.isActive === false) return false;
        if (
            [
                AssessmentStatus.CANCELLED,
                AssessmentStatus.COMPLETED,
                AssessmentStatus.PARTIALLY_COMPLETED,
                AssessmentStatus.EXPIRED,
            ].includes(assessmentInfo.status as AssessmentStatus)
        ) {
            return false;
        }
        if (assessmentInfo.expirationDate && new Date(assessmentInfo.expirationDate) < new Date()) {
            return false;
        }
        return true;
    }

    async sendEmail(
        assessmentInfo: Assessment,
        options: {
            event?: NotificationEvent;
            mailTemplate?: MailTemplate;
            updateAssessmentStatus?: boolean;
            metadata?: Record<string, any>;
        } = {},
    ): Promise<boolean> {
        if (!await this.notificationsEnabled()) return false;
        const event = options.event || NotificationEvent.ASSESSMENT_ASSIGNED;
        const mailTemplate = options.mailTemplate || assessmentInfo.mailTemplate;
        const updateAssessmentStatus = options.updateAssessmentStatus !== false;

        const questionnaireAssessment = await this.questionnaireAssessmentService.getById(
            assessmentInfo.questionnaireAssessmentId.toString(),
        );

        if (
            questionnaireAssessment.status === AssessmentStatus.CANCELLED ||
            questionnaireAssessment.status === AssessmentStatus.COMPLETED ||
            (assessmentInfo.expirationDate && new Date(assessmentInfo.expirationDate) < new Date()) ||
            assessmentInfo.deleted ||
            !mailTemplate
        ) {
            await this.notificationDispatchService.recordLog({
                channel: NotificationChannel.EMAIL,
                event,
                status: !mailTemplate
                    ? NotificationLogStatus.SKIPPED_NO_CONFIGURATION
                    : NotificationLogStatus.FAILED,
                recipientId: assessmentInfo.responderUserId,
                recipientEmail: assessmentInfo.receiverEmail,
                mailTemplateId: mailTemplate?.id || assessmentInfo.mailTemplateId,
                assessmentId: assessmentInfo.id,
                patientId: assessmentInfo.patientId,
                therapistId: assessmentInfo.targetUserId,
                message: !mailTemplate
                    ? 'No notification configuration resolved a mail template.'
                    : 'Assessment cannot receive assignment email in its current state.',
                metadata: {
                    assessmentId: assessmentInfo.id,
                    questionnaireAssessmentId: assessmentInfo.questionnaireAssessmentId,
                    ...(options.metadata || {}),
                },
            });
            if (updateAssessmentStatus) {
                await this.assessmentRepository.update(assessmentInfo.id, {
                    emailStatus: AssessmentEmailStatus.FAILED,
                });
            }
            return false;
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
            firstName: assessmentInfo.responderUser?.firstName,
            username: assessmentInfo.responderUser?.username,
            password: null,
            link: url,
            responder: this.userData(assessmentInfo.responderUser),
            recipient: this.userData(assessmentInfo.responderUser),
            patient: {
                ...this.personData(assessmentInfo.patient),
                medicalRecordNo: assessmentInfo.patient?.medicalRecordNo,
            },
            therapist: this.userData(assessmentInfo.targetUser),
            assessment: {
                id: assessmentInfo.id,
                name: assessmentInfo.assessmentType?.name,
                deliveryDate: this.formatDate(assessmentInfo.deliveryDate),
                expirationDate: this.formatDate(assessmentInfo.expirationDate),
                submissionDate: this.formatDate(assessmentInfo.submissionDate),
                responseStatus: assessmentInfo.status,
                link: url,
            },
        };

        let sent = false;
        await this.mailerService
            .sendMail({
                to: assessmentInfo.receiverEmail,
                from: this.resolveSender(mailTemplate),
                subject: mailTemplate.subject,
                html: template(templateData),
            })
            .then(async () => {
                if (updateAssessmentStatus) {
                    await this.assessmentRepository.update(assessmentInfo.id, {
                        emailStatus: AssessmentEmailStatus.SENT,
                    });
                }
                await this.notificationDispatchService.recordLog({
                    channel: NotificationChannel.EMAIL,
                    event,
                    status: NotificationLogStatus.SENT,
                    recipientId: assessmentInfo.responderUserId,
                    recipientEmail: assessmentInfo.receiverEmail,
                    mailTemplateId: mailTemplate.id,
                    assessmentId: assessmentInfo.id,
                    patientId: assessmentInfo.patientId,
                    therapistId: assessmentInfo.targetUserId,
                    subject: mailTemplate.subject,
                    metadata: {
                        assessmentId: assessmentInfo.id,
                        questionnaireAssessmentId: assessmentInfo.questionnaireAssessmentId,
                        ...(options.metadata || {}),
                    },
                });
                sent = true;
            })
            .catch(async (error) => {
                if (updateAssessmentStatus) {
                    await this.assessmentRepository.update(assessmentInfo.id, {
                        emailStatus: AssessmentEmailStatus.FAILED,
                    });
                }
                await this.notificationDispatchService.recordLog({
                    channel: NotificationChannel.EMAIL,
                    event,
                    status: NotificationLogStatus.FAILED,
                    recipientId: assessmentInfo.responderUserId,
                    recipientEmail: assessmentInfo.receiverEmail,
                    mailTemplateId: mailTemplate.id,
                    assessmentId: assessmentInfo.id,
                    patientId: assessmentInfo.patientId,
                    therapistId: assessmentInfo.targetUserId,
                    subject: mailTemplate.subject,
                    message: error?.message || 'Email delivery failed.',
                    metadata: {
                        assessmentId: assessmentInfo.id,
                        questionnaireAssessmentId: assessmentInfo.questionnaireAssessmentId,
                        ...(options.metadata || {}),
                    },
                });
            });
        return sent;
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

    private userData(user?: User): Record<string, any> {
        if (!user) return {};
        return {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: [user.firstName, user.lastName].filter(Boolean).join(' '),
            username: user.username,
            email: user.email,
        };
    }

    private personData(person?: { id?: number; firstName?: string; lastName?: string; email?: string }): Record<string, any> {
        if (!person) return {};
        return {
            id: person.id,
            firstName: person.firstName,
            lastName: person.lastName,
            fullName: [person.firstName, person.lastName].filter(Boolean).join(' '),
            email: person.email,
        };
    }

    private formatDate(date?: Date): string {
        if (!date) return null;
        return new Date(date).toLocaleDateString('es-AR');
    }

    private resolveSender(template?: { senderName?: string }): string {
        const senderMail = configService.getSenderMail();
        const senderName = (template?.senderName || '').trim();
        if (!senderName) return senderMail;
        return `"${senderName.replace(/"/g, '\\"')}" <${senderMail}>`;
    }

    /**
     * Send credentials to new users through the central notification configuration.
     */
    async sendWelcomeEmail(user: User, tempPassword: string): Promise<boolean> {
        try {
            if (!await this.notificationsEnabled()) return true;
            if (!user.email) {
                return true;
            }

            const configuration = await this.notificationConfigurationService.resolveMailConfigurationForRecipient({
                event: NotificationEvent.USER_CREATED,
                recipientUserId: user.id,
                targetUserId: user.id,
            });

            if (!configuration?.mailTemplate) {
                await this.notificationDispatchService.recordLog({
                    channel: NotificationChannel.EMAIL,
                    event: NotificationEvent.USER_CREATED,
                    status: NotificationLogStatus.SKIPPED_NO_CONFIGURATION,
                    recipientId: user.id,
                    recipientEmail: user.email,
                    message: 'No active notification configuration matched the created user.',
                });
                return true;
            }

            Handlebars.registerHelper('helperMissing', function(val) {
                if (val === undefined) return null;
                return val;
            });

            const mailTemplate = configuration.mailTemplate;
            const loginUrl = this.getLoginUrl();
            const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
            const templateFn = Handlebars.compile(mailTemplate.body);
            const html = templateFn({
                firstName: user.firstName,
                lastName: user.lastName,
                fullName,
                username: user.username,
                password: tempPassword,
                loginUrl,
                link: loginUrl,
                recipient: {
                    id: user.id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    fullName,
                    username: user.username,
                    email: user.email,
                },
                user: {
                    id: user.id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    fullName,
                    username: user.username,
                    email: user.email,
                    lastLoginAt: user.lastLoginAt,
                    previousLastLoginAt: user.previousLastLoginAt,
                },
            });

            await this.mailerService.sendMail({
                to: user.email,
                from: this.resolveSender(mailTemplate),
                subject: mailTemplate.subject,
                html: html,
            });

            await this.notificationDispatchService.recordLog({
                channel: NotificationChannel.EMAIL,
                event: NotificationEvent.USER_CREATED,
                status: NotificationLogStatus.SENT,
                notificationConfigurationId: configuration.id,
                recipientId: user.id,
                recipientEmail: user.email,
                mailTemplateId: mailTemplate.id,
                subject: mailTemplate.subject,
            });
            return true;
        } catch (error) {
            await this.notificationDispatchService.recordLog({
                channel: NotificationChannel.EMAIL,
                event: NotificationEvent.USER_CREATED,
                status: NotificationLogStatus.FAILED,
                recipientId: user.id,
                recipientEmail: user.email,
                message: error?.message || 'User creation email delivery failed.',
            });
            return false;
        }
    }

    private getLoginUrl(): string {
        return `${configService.getAppUrl().replace(/\/$/, '')}/auth/login`;
    }

    private async notificationsEnabled(): Promise<boolean> {
        return (await this.settingService.getKey(SettingKey.NOTIFICATIONS_ENABLED)) !== false;
    }
}
