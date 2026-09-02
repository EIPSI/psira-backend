import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Assessment } from 'src/modules/assessment/models/assessment.model';
import { AssessmentStatus } from 'src/modules/questionnaire/enums/assessment-status.enum';
import { Repository } from 'typeorm';
import { SettingKey } from 'src/modules/setting/enums/setting-name.enum';
import { SettingService } from 'src/modules/setting/providers/setting.service';
import { NotificationEvent } from '../enums/notification-event.enum';
import { NotificationLog } from '../models/notification-log.model';
import { NotificationPreference } from '../models/notification-preference.model';
import { NotificationDispatchService } from './notification-dispatch.service';
import { NotificationPreferenceService } from './notification-preference.service';

@Injectable()
export class NotificationPeriodicService {
    constructor(
        @InjectRepository(NotificationPreference)
        private readonly preferenceRepository: Repository<NotificationPreference>,
        @InjectRepository(Assessment)
        private readonly assessmentRepository: Repository<Assessment>,
        @InjectRepository(NotificationLog)
        private readonly logRepository: Repository<NotificationLog>,
        private readonly dispatchService: NotificationDispatchService,
        private readonly preferenceService: NotificationPreferenceService,
        private readonly settingService: SettingService,
    ) {}

    @Cron(CronExpression.EVERY_HOUR)
    async checkDueAssessmentNotifications(): Promise<void> {
        if ((await this.settingService.getKey(SettingKey.NOTIFICATIONS_ENABLED)) === false) return;
        await this.dispatchNotAnsweredNotifications();
        await this.dispatchPeriodicSummaries();
    }

    private async dispatchNotAnsweredNotifications(): Promise<void> {
        const now = new Date();
        const expiredAssessments = await this.assessmentRepository
            .createQueryBuilder('assessment')
            .where('assessment."expirationDate" < :now', { now })
            .andWhere('(assessment.deleted = false OR assessment.deleted IS NULL)')
            .getMany();

        for (const assessment of expiredAssessments) {
            if (
                assessment.status === AssessmentStatus.COMPLETED ||
                assessment.status === AssessmentStatus.CANCELLED ||
                assessment.submissionDate
            ) {
                continue;
            }
            const alreadyLogged = await this.logRepository.count({
                where: {
                    event: NotificationEvent.ASSESSMENT_NOT_ANSWERED,
                    assessmentId: assessment.id,
                },
            });
            if (!alreadyLogged) {
                await this.dispatchService.dispatchAssessmentEvent(
                    NotificationEvent.ASSESSMENT_NOT_ANSWERED,
                    assessment.id,
                );
            }
        }
    }

    private async dispatchPeriodicSummaries(): Promise<void> {
        const now = new Date();
        const preferences = await this.preferenceRepository.find();

        for (const preference of preferences) {
            if (
                !this.preferenceService.isPeriodicDue(preference, now) ||
                !this.preferenceService.isEventEnabled(
                    preference,
                    NotificationEvent.ASSESSMENT_PERIODIC_SUMMARY,
                )
            ) {
                continue;
            }

            const periodStart = this.preferenceService.periodStart(preference, now);
            const query = this.assessmentRepository
                .createQueryBuilder('assessment')
                .leftJoinAndSelect('assessment.assessmentType', 'assessmentType')
                .where('assessment."deliveryDate" >= :periodStart', { periodStart })
                .andWhere('(assessment.deleted = false OR assessment.deleted IS NULL)')
                .orderBy('assessment."deliveryDate"', 'ASC');
            if (preference.patientId) {
                query.andWhere('assessment."patientId" = :patientId', {
                    patientId: preference.patientId,
                });
            }
            if (preference.therapistId) {
                query.andWhere('assessment."targetUserId" = :therapistId', {
                    therapistId: preference.therapistId,
                });
            }

            const assessments = await query.getMany();

            await this.dispatchService.dispatchPeriodicSummary({
                patientId: preference.patientId,
                therapistId: preference.therapistId,
                periodStart,
                periodEnd: now,
                assessments,
            });

            preference.lastPeriodicSentAt = now;
            await this.preferenceRepository.save(preference);
        }
    }
}
