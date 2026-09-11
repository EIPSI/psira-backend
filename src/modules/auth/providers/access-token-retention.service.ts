import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SettingKey } from 'src/modules/setting/enums/setting-name.enum';
import { SettingService } from 'src/modules/setting/providers/setting.service';
import { AccessToken } from '../models/access-token.model';

@Injectable()
export class AccessTokenRetentionService {
    private readonly logger = new Logger('AccessTokenRetentionService');

    constructor(private readonly settingService: SettingService) {}

    @Cron('40 3 * * *')
    async pruneOldAccessTokens(): Promise<void> {
        const retentionDays = await this.settingService.getKey(
            SettingKey.ACCESS_TOKEN_RETENTION_DAYS,
        );

        if (!retentionDays || retentionDays < 1) {
            return;
        }

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - retentionDays);

        const result = await AccessToken.createQueryBuilder()
            .delete()
            .where('"expiresAt" < :cutoff', { cutoff })
            .orWhere('"isRevoked" = true AND "updatedAt" < :cutoff', { cutoff })
            .execute();

        if (result.affected) {
            this.logger.log(
                `Deleted ${result.affected} expired or revoked access tokens older than ${retentionDays} days`,
            );
        }
    }
}
