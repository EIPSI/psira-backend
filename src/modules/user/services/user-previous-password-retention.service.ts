import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SettingKey } from 'src/modules/setting/enums/setting-name.enum';
import { SettingService } from 'src/modules/setting/providers/setting.service';
import { LessThan } from 'typeorm';
import { UserPreviousPassword } from '../models/user-previous-password.model';

@Injectable()
export class UserPreviousPasswordRetentionService {
    private readonly logger = new Logger('UserPreviousPasswordRetentionService');

    constructor(private readonly settingService: SettingService) {}

    @Cron('0 4 * * *')
    async pruneOldPreviousPasswords(): Promise<void> {
        const cutoffDays = await this.settingService.getKey(
            SettingKey.PASSWORD_REUSE_CUTOFF_IN_DAYS,
        );

        if (!cutoffDays || cutoffDays < 1) {
            return;
        }

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - cutoffDays);

        const result = await UserPreviousPassword.delete({
            createdAt: LessThan(cutoff),
        });

        if (result.affected) {
            this.logger.log(
                `Deleted ${result.affected} previous password hashes older than ${cutoffDays} days`,
            );
        }
    }
}
