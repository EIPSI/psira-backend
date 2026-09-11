import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Assessment } from 'src/modules/assessment/models/assessment.model';
import { AssessmentStatus } from 'src/modules/questionnaire/enums/assessment-status.enum';
import { User } from 'src/modules/user/models/user.model';
import { configService } from 'src/config/config.service';
import { SettingKey } from 'src/modules/setting/enums/setting-name.enum';
import { SettingService } from 'src/modules/setting/providers/setting.service';
import * as momentTimezone from 'moment-timezone';
import { url } from 'src/shared';
import * as CryptoJS from 'crypto-js';
import * as Handlebars from 'handlebars';
import { Repository } from 'typeorm';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { NotificationEvent } from '../enums/notification-event.enum';
import { NotificationLogStatus } from '../enums/notification-log-status.enum';
import { NotificationLog } from '../models/notification-log.model';
import { NotificationConfigurationService } from './notification-configuration.service';
import { NotificationPreferenceService } from './notification-preference.service';
import { MailerService } from 'src/shared/mail/mailer.service';
import { formatEmailAddress } from 'src/shared';

@Injectable()
export class NotificationDispatchService {
    constructor(
        @InjectRepository(NotificationLog)
        private readonly notificationLogRepository: Repository<NotificationLog>,
        @InjectRepository(Assessment)
        private readonly assessmentRepository: Repository<Assessment>,
        private readonly mailerService: MailerService,
        private readonly configurationService: NotificationConfigurationService,
        private readonly preferenceService: NotificationPreferenceService,
        private readonly settingService: SettingService,
    ) {}

    async dispatchAssessmentEvent(
        event: NotificationEvent,
        assessmentId: number,
    ): Promise<void> {
        if (!await this.notificationsEnabled()) return;
        if (
            ![
                NotificationEvent.ASSESSMENT_ANSWERED,
                NotificationEvent.ASSESSMENT_NOT_ANSWERED,
            ].includes(event)
        ) {
            return;
        }

        const assessment = await this.assessmentRepository.findOne({
            where: { id: assessmentId },
            relations: [
                'assessmentType',
                'patient',
                'patient.caseManagers',
                'patient.departments',
                'targetUser',
                'targetUser.supervisors',
                'targetUser.departments',
                'responderUser',
            ],
        });
        if (!assessment || assessment.deleted) return;

        if (event === NotificationEvent.ASSESSMENT_NOT_ANSWERED) {
            const previousLog = await this.notificationLogRepository.count({
                where: { event, assessmentId: assessment.id },
            });
            if (previousLog) return;
        }

        const scope = assessment.patientId
            ? { patientId: assessment.patientId }
            : { therapistId: assessment.targetUserId };
        if (!scope.patientId && !scope.therapistId) return;

        const preference = await this.preferenceService.getOrCreate(scope);
        if (
            !preference.enabled ||
            !preference.immediateEnabled ||
            !this.preferenceService.isEventEnabled(preference, event)
        ) {
            await this.recordLog({
                channel: NotificationChannel.EMAIL,
                event,
                status: NotificationLogStatus.SKIPPED_DISABLED,
                assessmentId: assessment.id,
                patientId: assessment.patientId,
                therapistId: assessment.targetUserId,
                message: 'Immediate notifications are disabled for this case.',
            });
            return;
        }

        const recipients = this.resolveResponsibleRecipients(assessment);
        if (!recipients.length) {
            await this.recordLog({
                channel: NotificationChannel.EMAIL,
                event,
                status: NotificationLogStatus.SKIPPED_NO_CONFIGURATION,
                assessmentId: assessment.id,
                patientId: assessment.patientId,
                therapistId: assessment.targetUserId,
                message: 'No responsible recipients found for this assessment.',
            });
            return;
        }

        for (const recipient of recipients) {
            if (!recipient.email) continue;
            if (!this.preferenceService.isRecipientAllowed(preference, recipient.id)) {
                await this.recordLog({
                    channel: NotificationChannel.EMAIL,
                    event,
                    status: NotificationLogStatus.SKIPPED_RECIPIENT_OPTED_OUT,
                    recipientId: recipient.id,
                    recipientEmail: recipient.email,
                    assessmentId: assessment.id,
                    patientId: assessment.patientId,
                    therapistId: assessment.targetUserId,
                });
                continue;
            }

            const configuration = await this.configurationService.resolveMailConfigurationForRecipient({
                event,
                recipientUserId: recipient.id,
                patientId: assessment.patientId,
                targetUserId: assessment.targetUserId,
            });
            if (!configuration?.mailTemplate) {
                await this.recordLog({
                    channel: NotificationChannel.EMAIL,
                    event,
                    status: NotificationLogStatus.SKIPPED_NO_CONFIGURATION,
                    recipientId: recipient.id,
                    recipientEmail: recipient.email,
                    assessmentId: assessment.id,
                    patientId: assessment.patientId,
                    therapistId: assessment.targetUserId,
                    message: 'No active template configuration matched this recipient.',
                });
                continue;
            }

            await this.sendTemplateEmail({
                event,
                assessment,
                recipient,
                configurationId: configuration.id,
                template: configuration.mailTemplate,
            });
        }
    }

    async dispatchPeriodicSummary(input: {
        patientId?: number;
        therapistId?: number;
        periodStart: Date;
        periodEnd: Date;
        assessments: Assessment[];
    }): Promise<void> {
        if (!await this.notificationsEnabled()) return;
        if (!input.assessments.length) return;
        const sample = input.assessments[0];
        const hydrated = await this.assessmentRepository.findOne({
            where: { id: sample.id },
            relations: [
                'patient',
                'patient.caseManagers',
                'targetUser',
                'targetUser.supervisors',
            ],
        });
        const recipients = hydrated
            ? this.resolveResponsibleRecipients(hydrated)
            : [];

        for (const recipient of recipients) {
            if (!recipient.email) continue;
            const configuration = await this.configurationService.resolveMailConfigurationForRecipient({
                event: NotificationEvent.ASSESSMENT_PERIODIC_SUMMARY,
                recipientUserId: recipient.id,
                patientId: input.patientId,
                targetUserId: input.therapistId,
            });
            if (!configuration?.mailTemplate) {
                await this.recordLog({
                    channel: NotificationChannel.EMAIL,
                    event: NotificationEvent.ASSESSMENT_PERIODIC_SUMMARY,
                    status: NotificationLogStatus.SKIPPED_NO_CONFIGURATION,
                    recipientId: recipient.id,
                    recipientEmail: recipient.email,
                    patientId: input.patientId,
                    therapistId: input.therapistId,
                });
                continue;
            }

            await this.sendTemplateEmail({
                event: NotificationEvent.ASSESSMENT_PERIODIC_SUMMARY,
                assessment: hydrated || sample,
                recipient,
                configurationId: configuration.id,
                template: configuration.mailTemplate,
                extraData: {
                    period: {
                        start: await this.formatDateTime(input.periodStart),
                        end: await this.formatDateTime(input.periodEnd),
                    },
                    assessmentsTable: await this.buildAssessmentsTable(input.assessments),
                },
            });
        }
    }

    async dispatchUserEvent(input: {
        event: NotificationEvent;
        recipient: User;
        patientId?: number;
        therapistId?: number;
        data?: Record<string, any>;
    }): Promise<void> {
        if (!await this.notificationsEnabled()) return;
        if (!input.recipient?.email) return;
        const configuration = await this.configurationService.resolveMailConfigurationForRecipient({
            event: input.event,
            recipientUserId: input.recipient.id,
            patientId: input.patientId,
            targetUserId: input.therapistId,
        });
        if (!configuration?.mailTemplate) {
            await this.recordLog({
                channel: NotificationChannel.EMAIL,
                event: input.event,
                status: NotificationLogStatus.SKIPPED_NO_CONFIGURATION,
                recipientId: input.recipient.id,
                recipientEmail: input.recipient.email,
                patientId: input.patientId,
                therapistId: input.therapistId,
                message: 'No active template configuration matched this recipient.',
            });
            return;
        }

        Handlebars.registerHelper('helperMissing', function(val) {
            if (val === undefined) return null;
            return val;
        });

        const templateFn = Handlebars.compile(configuration.mailTemplate.body);
        const consentLink = this.generatePublicInformedConsentURL(input.recipient.id);
        const data = {
            firstName: input.recipient.firstName,
            username: input.recipient.username,
            recipient: this.userData(input.recipient),
            user: this.userData(input.recipient),
            link: input.data?.link || null,
            ...input.data,
            consent: {
                link: consentLink,
                pendingLink: consentLink,
                ...(input.data?.consent || {}),
            },
        };

        try {
            await this.mailerService.sendMail({
                to: input.recipient.email,
                from: this.resolveSender(configuration.mailTemplate),
                subject: configuration.mailTemplate.subject,
                html: templateFn(data),
            });
            await this.recordLog({
                channel: NotificationChannel.EMAIL,
                event: input.event,
                status: NotificationLogStatus.SENT,
                notificationConfigurationId: configuration.id,
                recipientId: input.recipient.id,
                recipientEmail: input.recipient.email,
                mailTemplateId: configuration.mailTemplate.id,
                patientId: input.patientId,
                therapistId: input.therapistId,
                subject: configuration.mailTemplate.subject,
            });
        } catch (error) {
            await this.recordLog({
                channel: NotificationChannel.EMAIL,
                event: input.event,
                status: NotificationLogStatus.FAILED,
                notificationConfigurationId: configuration.id,
                recipientId: input.recipient.id,
                recipientEmail: input.recipient.email,
                mailTemplateId: configuration.mailTemplate.id,
                patientId: input.patientId,
                therapistId: input.therapistId,
                subject: configuration.mailTemplate.subject,
                message: error?.message || 'Email delivery failed.',
            });
        }
    }

    async recordLog(input: {
        channel: NotificationChannel;
        event: NotificationEvent;
        status: NotificationLogStatus;
        notificationConfigurationId?: number;
        recipientId?: number;
        recipientEmail?: string;
        mailTemplateId?: number;
        assessmentId?: number;
        patientId?: number;
        therapistId?: number;
        subject?: string;
        message?: string;
        metadata?: Record<string, any>;
    }): Promise<NotificationLog> {
        return this.notificationLogRepository.save(
            this.notificationLogRepository.create(input),
        );
    }

    private async sendTemplateEmail(input: {
        event: NotificationEvent;
        assessment: Assessment;
        recipient: User;
        configurationId: number;
        template: { id: number; subject: string; body: string; senderName?: string };
        extraData?: Record<string, any>;
    }): Promise<void> {
        if (!await this.notificationsEnabled()) return;
        Handlebars.registerHelper('helperMissing', function(val) {
            if (val === undefined) return null;
            return val;
        });

        const templateFn = Handlebars.compile(input.template.body);
        const data = await this.buildTemplateData(input.assessment, input.recipient, input.extraData);

        try {
            await this.mailerService.sendMail({
                to: input.recipient.email,
                from: this.resolveSender(input.template),
                subject: input.template.subject,
                html: templateFn(data),
            });
            await this.recordLog({
                channel: NotificationChannel.EMAIL,
                event: input.event,
                status: NotificationLogStatus.SENT,
                notificationConfigurationId: input.configurationId,
                recipientId: input.recipient.id,
                recipientEmail: input.recipient.email,
                mailTemplateId: input.template.id,
                assessmentId: input.assessment.id,
                patientId: input.assessment.patientId,
                therapistId: input.assessment.targetUserId,
                subject: input.template.subject,
            });
        } catch (error) {
            await this.recordLog({
                channel: NotificationChannel.EMAIL,
                event: input.event,
                status: NotificationLogStatus.FAILED,
                notificationConfigurationId: input.configurationId,
                recipientId: input.recipient.id,
                recipientEmail: input.recipient.email,
                mailTemplateId: input.template.id,
                assessmentId: input.assessment.id,
                patientId: input.assessment.patientId,
                therapistId: input.assessment.targetUserId,
                subject: input.template.subject,
                message: error?.message || 'Email delivery failed.',
            });
        }
    }

    private resolveResponsibleRecipients(assessment: Assessment): User[] {
        const recipients = assessment.patientId
            ? assessment.patient?.caseManagers || []
            : assessment.targetUser?.supervisors || [];
        const seen = new Set<number>();
        return recipients.filter(recipient => {
            if (!recipient?.id || seen.has(recipient.id)) return false;
            seen.add(recipient.id);
            return true;
        });
    }

    private async notificationsEnabled(): Promise<boolean> {
        return (await this.settingService.getKey(SettingKey.NOTIFICATIONS_ENABLED)) !== false;
    }

    private resolveSender(template?: { senderName?: string }): string {
        return formatEmailAddress(configService.getSenderMail(), template?.senderName);
    }
    private async buildTemplateData(
        assessment: Assessment,
        recipient: User,
        extraData?: Record<string, any>,
    ): Promise<Record<string, any>> {
        const patientName = this.fullName(assessment.patient);
        const therapistName = this.fullName(assessment.targetUser);
        const assessmentLink = assessment.uuid
            ? this.generateAssessmentURL(assessment.uuid)
            : null;

        return {
            firstName: recipient.firstName,
            username: recipient.username,
            password: null,
            recipient: this.userData(recipient),
            patient: {
                ...this.personData(assessment.patient),
                fullName: patientName,
                medicalRecordNo: assessment.patient?.medicalRecordNo,
            },
            therapist: {
                ...this.userData(assessment.targetUser),
                fullName: therapistName,
            },
            supervisor: this.userData(recipient),
            caseManager: this.userData(recipient),
            assessment: {
                id: assessment.id,
                name: assessment.assessmentType?.name,
                deliveryDate: await this.formatDateTime(assessment.deliveryDate),
                expirationDate: await this.formatDateTime(assessment.expirationDate),
                submissionDate: await this.formatDateTime(assessment.submissionDate),
                responseStatus: assessment.status,
                link: assessmentLink,
            },
            link: assessmentLink,
            ...extraData,
        };
    }

    private async buildAssessmentsTable(assessments: Assessment[]): Promise<string> {
        const rows = await Promise.all(assessments
            .map(async assessment => {
                const name = assessment.assessmentType?.name || `Evaluación #${assessment.id}`;
                const status = assessment.submissionDate || assessment.status === AssessmentStatus.COMPLETED
                    ? 'Respondida'
                    : 'No respondida';
                return `<tr><td>${name}</td><td>${await this.formatDateTime(assessment.deliveryDate) || '-'}</td><td>${status}</td></tr>`;
            }));
        return `<table><thead><tr><th>Evaluación</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
    }

    private userData(user?: User): Record<string, any> {
        if (!user) return {};
        return {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: this.fullName(user),
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
            email: person.email,
        };
    }

    private fullName(person?: { firstName?: string; lastName?: string }): string {
        return [person?.firstName, person?.lastName].filter(Boolean).join(' ');
    }

    private async formatDateTime(date?: Date): Promise<string> {
        if (!date) return null;
        const [locale, timezone, dateFormat, timeFormat, dateTimeFormat] = await Promise.all([
            this.settingService.getKey(SettingKey.SYSTEM_LOCALE),
            this.settingService.getKey(SettingKey.SYSTEM_TIMEZONE),
            this.settingService.getKey(SettingKey.DATE_FORMAT),
            this.settingService.getKey(SettingKey.TIME_FORMAT),
            this.settingService.getKey(SettingKey.DATETIME_FORMAT),
        ]);
        const resolvedFormat = !dateTimeFormat || dateTimeFormat === 'YYYY-MM-DD LT'
            ? `${dateFormat || 'YYYY-MM-DD'} ${timeFormat || 'LT'}`
            : dateTimeFormat;
        const value = momentTimezone(date);
        const withTimezone = timezone && momentTimezone.tz.zone(timezone)
            ? value.tz(timezone)
            : value;
        return withTimezone
            .locale(locale || 'en')
            .format(resolvedFormat);
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

    private generatePublicInformedConsentURL(userId: number): string {
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 6);
        const cryptoId = CryptoJS.AES.encrypt(
            JSON.stringify({ userId, exp: expiresAt.getTime() }),
            configService.getFrontendEncryptionKey(),
        ).toString();
        return url(`informed-consent/pending?token=${encodeURIComponent(cryptoId)}`);
    }
}
