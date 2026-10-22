import { getConnection } from 'typeorm';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { User } from 'src/modules/user/models/user.model';
import { NotificationLog } from 'src/modules/notification/models/notification-log.model';
import { NotificationEvent } from 'src/modules/notification/enums/notification-event.enum';
import { NotificationLogStatus } from 'src/modules/notification/enums/notification-log-status.enum';
import { NotificationDispatchService } from 'src/modules/notification/services/notification-dispatch.service';
import { InformedConsentManagement } from '../models/informed-consent-management.model';
import { InformedConsentResponseService } from './informed-consent-response.service';

@Injectable()
export class InformedConsentReminderService {
    private running = false;
    private readonly logger = new Logger(InformedConsentReminderService.name);

    constructor(
        private readonly responses: InformedConsentResponseService,
        private readonly dispatch: NotificationDispatchService,
    ) {}

    @Cron(CronExpression.EVERY_MINUTE)
    async sendPending(): Promise<void> {
        if (this.running) return;
        this.running = true;
        const runner = getConnection().createQueryRunner();
        let locked = false;
        try {
            await runner.connect();
            const [result] = await runner.query('SELECT pg_try_advisory_lock(1788900003) AS locked');
            locked = result.locked;
            if (!locked) return;
            const users = await User.find({ where: { active: true } });
            for (const user of users) {
                try {
                    await this.sendForUser(user);
                } catch (error) {
                    this.logger.error(`Consent notification failed for user ${user.id}: ${error.message}`);
                }
            }
        } finally {
            try {
                if (locked) await runner.query('SELECT pg_advisory_unlock(1788900003)');
            } finally {
                try { await runner.release(); } finally { this.running = false; }
            }
        }
    }

    private async sendForUser(user: User): Promise<void> {
        const pending = await this.responses.pendingForUser(user.id);
        for (const item of pending) {
            if (item.blocking) continue;
            const management = await InformedConsentManagement.findOne(item.managementId, {
                relations: ['model', 'model.currentPublishedVersion'],
            });
            if (!management) continue;
            const logs = await NotificationLog.find({ where: {
                recipientId: user.id,
                event: NotificationEvent.INFORMED_CONSENT_PENDING,
                status: NotificationLogStatus.SENT,
            } });
            const initialKey = `${management.id}:${item.versionId}:initial`;
            const initial = logs.find(log => log.metadata?.consentReminderKey === initialKey);
            let key = initialKey;
            if (initial) {
                key = undefined;
                for (const offset of [...(management.reminderOffsets || [])].sort((a, b) => a - b)) {
                    const due = new Date(initial.createdAt);
                    if (management.reminderUnit === 'MONTHS') {
                        const day = due.getUTCDate();
                        due.setUTCDate(1);
                        due.setUTCMonth(due.getUTCMonth() + offset);
                        const lastDay = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0)).getUTCDate();
                        due.setUTCDate(Math.min(day, lastDay));
                    }
                    else due.setUTCDate(due.getUTCDate() + offset * (management.reminderUnit === 'WEEKS' ? 7 : 1));
                    const reminderKey = `${management.id}:${item.versionId}:${management.reminderUnit}:${offset}`;
                    if (due <= new Date()) {
                        key = reminderKey;
                    }
                }
            }
            if (!key || logs.some(log => log.metadata?.consentReminderKey === key)) continue;
            await this.dispatch.dispatchUserEvent({
                event: NotificationEvent.INFORMED_CONSENT_PENDING,
                recipient: user,
                metadata: { consentReminderKey: key },
                data: { consent: {
                    modelName: management.model.name,
                    version: management.model.currentPublishedVersion?.versionNumber,
                    link: this.responses.publicResponseLinkForUser(user.id),
                    pendingLink: this.responses.publicResponseLinkForUser(user.id),
                } },
            });
        }
    }
}
