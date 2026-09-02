import { Injectable } from '@nestjs/common';
import { SettingKey } from 'src/modules/setting/enums/setting-name.enum';
import { SettingService } from 'src/modules/setting/providers/setting.service';
import { InformedConsentResponseService } from './informed-consent-response.service';

@Injectable()
export class InformedConsentAccessService {
    private readonly allowedWhileBlocked = new Set([
        'logout',
        'changePassword',
        'settings',
        'disclaimers',
        'updateUserAcceptedTerm',
        'getUserProfile',
        'userPermissionGrants',
        'pendingInformedConsents',
    ]);

    constructor(
        private readonly responseService: InformedConsentResponseService,
        private readonly settingService: SettingService,
    ) {}

    async shouldBlockOperation(userId: number, operationName?: string): Promise<boolean> {
        if (!operationName || this.allowedWhileBlocked.has(operationName)) return false;
        const informedConsentEnabled = await this.settingService.getKey(SettingKey.INFORMED_CONSENT_ENABLED);
        if (informedConsentEnabled === false) return false;
        return this.responseService.hasBlockingPending(userId);
    }
}
