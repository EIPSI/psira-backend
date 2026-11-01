import { ClinicalSessionFollowUpSetting } from 'src/modules/clinical-session/models/clinical-session-follow-up-setting.model';
import { In } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { SettingDto } from '../dtos/setting.dto';
import { UpdateSettingInput } from '../dtos/update-setting.input';
import { Setting } from '../models/setting.model';
import { defaultConfig } from '../config/default-config';

@Injectable()
export class SettingService {
    async get<K extends keyof SettingDto>(): Promise<SettingDto> {
        const storedSettings = await Setting.find();

        const settingDto = new SettingDto();
        for (const key in defaultConfig) {
            const storedSetting = storedSettings.find(row => row.key === key);

            const value = storedSetting
                ? this.parseValue(key as K, storedSetting.value)
                : defaultConfig[key];

            settingDto[key] = value;
        }

        return settingDto;
    }

    async getKey<K extends keyof SettingDto>(key?: K): Promise<SettingDto[K]> {
        const storedSetting = await Setting.findOne({ key });

        const value: SettingDto[K] = storedSetting
            ? this.parseValue(key, storedSetting.value)
            : defaultConfig[key];

        return value;
    }

    async clinicalSettings(departmentIds: number[] = []): Promise<ClinicalSessionFollowUpSetting> {
        const base = await ClinicalSessionFollowUpSetting.findOne(1);
        const defaults = { id: 1, editWindowDays: base?.editWindowDays ?? 7,
            dashboardLookaheadDays: base?.dashboardLookaheadDays ?? 1,
            patientCaseManagerRoleCodes: await this.getKey('patientCaseManagerRoleCodes'),
            therapistSupervisorRoleCodes: await this.getKey('therapistSupervisorRoleCodes'),
            updatedAt: base?.updatedAt || new Date() };
        const ids = [...new Set(departmentIds)];
        if (!ids.length) return Object.assign(new ClinicalSessionFollowUpSetting(), defaults);
        const overrides = await ClinicalSessionFollowUpSetting.find({ where: { departmentId: In(ids) } });
        const values = ids.map(id => ({ ...defaults, ...overrides.find(row => row.departmentId === id) }));
        return Object.assign(new ClinicalSessionFollowUpSetting(), defaults, {
            departmentId: ids.length === 1 ? ids[0] : undefined,
            editWindowDays: Math.min(...values.map(row => row.editWindowDays)),
            dashboardLookaheadDays: Math.max(...values.map(row => row.dashboardLookaheadDays)),
            patientCaseManagerRoleCodes: [...new Set(values.flatMap(row => row.patientCaseManagerRoleCodes || defaults.patientCaseManagerRoleCodes))],
            therapistSupervisorRoleCodes: [...new Set(values.flatMap(row => row.therapistSupervisorRoleCodes || defaults.therapistSupervisorRoleCodes))],
        });
    }

    async clinicalRoleCodes(key: 'patientCaseManagerRoleCodes' | 'therapistSupervisorRoleCodes', departmentIds: number[] = []): Promise<string[]> {
        return (await this.clinicalSettings(departmentIds))[key] || [];
    }

    async update<K extends keyof SettingDto>(
        settingDto: UpdateSettingInput,
    ): Promise<boolean> {
        for (const key in settingDto) {
            const settingKey = key as K;
            const value = settingDto[settingKey];

            if (value !== null && value !== undefined) {
                await this.updateKey(settingKey, value);
            }
        }

        return true;
    }

    async updateKey<K extends keyof SettingDto>(
        key: K,
        value: SettingDto[K],
    ): Promise<boolean> {
        const stringValue = this.stringifyValue(value);

        const storedSetting = await Setting.findOne({ key });

        // Update existing setting entry
        if (storedSetting) {
            // Update only if value has changed
            if (storedSetting.value !== stringValue) {
                storedSetting.value = stringValue;
                await storedSetting.save();
            }

            return true;
        }

        // Create new setting entry
        const setting = new Setting();
        setting.key = key;
        setting.value = stringValue;

        await setting.save();

        return true;
    }

    private parseValue<K extends keyof SettingDto>(key: K, value: string): SettingDto[K] {
        const defaultValue = defaultConfig[key];

        if (typeof defaultValue === 'boolean') {
            return (value === 'true') as SettingDto[K];
        }

        if (typeof defaultValue === 'number') {
            const parsed = parseInt(value, 10);
            return (Number.isNaN(parsed) ? null : parsed) as SettingDto[K];
        }

        if (Array.isArray(defaultValue)) {
            try {
                const parsed = JSON.parse(value);
                return (Array.isArray(parsed) ? parsed : value.split(',').filter(Boolean)) as SettingDto[K];
            } catch (_) {
                return value.split(',').filter(Boolean) as SettingDto[K];
            }
        }

        return value as SettingDto[K];
    }

    private stringifyValue(value: any): string {
        return Array.isArray(value) ? JSON.stringify(value) : value.toString();
    }
}
