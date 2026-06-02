import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { SettingKey } from 'src/modules/setting/enums/setting-name.enum';
import { SettingService } from 'src/modules/setting/providers/setting.service';
import { LessThan, Repository } from 'typeorm';
import { EvaluationAutomationRun } from '../models/evaluation-automation-run.model';

@Injectable()
export class EvaluationAutomationRetentionService {
    private readonly logger = new Logger('EvaluationAutomationRetentionService');

    constructor(
        @InjectRepository(EvaluationAutomationRun)
        private readonly runRepository: Repository<EvaluationAutomationRun>,
        private readonly settingService: SettingService,
    ) {}

    @Cron('0 3 * * *')
    async pruneOldRuns(): Promise<void> {
        const retentionDays = await this.settingService.getKey(
            SettingKey.EVALUATION_AUTOMATION_RUN_RETENTION_DAYS,
        );

        if (!retentionDays || retentionDays < 1) {
            return;
        }

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - retentionDays);

        const result = await this.runRepository.delete({
            createdAt: LessThan(cutoff),
        });

        if (result.affected) {
            this.logger.log(
                `Deleted ${result.affected} evaluation automation runs older than ${retentionDays} days`,
            );
        }
    }
}
