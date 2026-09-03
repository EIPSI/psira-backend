import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { SettingKey } from 'src/modules/setting/enums/setting-name.enum';
import { SettingService } from 'src/modules/setting/providers/setting.service';
import { LessThan, Repository } from 'typeorm';
import { NotificationLog } from '../models/notification-log.model';

@Injectable()
export class NotificationLogRetentionService {
    private readonly logger = new Logger('NotificationLogRetentionService');

    constructor(
        @InjectRepository(NotificationLog)
        private readonly logRepository: Repository<NotificationLog>,
        private readonly settingService: SettingService,
    ) {}

    @Cron('20 3 * * *')
    async pruneOldNotificationLogs(): Promise<void> {
        const retentionDays = await this.settingService.getKey(
            SettingKey.NOTIFICATION_LOG_RETENTION_DAYS,
        );

        if (!retentionDays || retentionDays < 1) {
            return;
        }

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - retentionDays);

        const result = await this.logRepository.delete({
            createdAt: LessThan(cutoff),
        });

        if (result.affected) {
            this.logger.log(
                `Deleted ${result.affected} notification logs older than ${retentionDays} days`,
            );
        }
    }
}
