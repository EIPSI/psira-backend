import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Patient } from 'src/modules/patient/models/patient.model';
import { User } from 'src/modules/user/models/user.model';
import { Repository } from 'typeorm';
import {
    NotificationPreferenceQueryInput,
    UpdateNotificationPreferenceInput,
} from '../dtos/notification-preference.input';
import { NotificationEvent } from '../enums/notification-event.enum';
import { NotificationPeriodicUnit } from '../enums/notification-periodic-unit.enum';
import { NotificationPreference } from '../models/notification-preference.model';

@Injectable()
export class NotificationPreferenceService {
    private readonly defaultEvents = [
        NotificationEvent.ASSESSMENT_ASSIGNED,
        NotificationEvent.ASSESSMENT_REMINDER,
        NotificationEvent.ASSESSMENT_ANSWERED,
        NotificationEvent.ASSESSMENT_NOT_ANSWERED,
        NotificationEvent.ASSESSMENT_PERIODIC_SUMMARY,
        NotificationEvent.CASE_UPDATED,
        NotificationEvent.USER_CREATED,
        NotificationEvent.FIRST_LOGIN,
        NotificationEvent.LAST_LOGIN,
        NotificationEvent.SESSION_NUMBER,
        NotificationEvent.TREATMENT_FINALIZATION,
        NotificationEvent.SESSION_NO_SHOW_CANCELLATION,
        NotificationEvent.NEW_TREATMENT,
    ];

    constructor(
        @InjectRepository(NotificationPreference)
        private readonly preferenceRepository: Repository<NotificationPreference>,
        @InjectRepository(Patient)
        private readonly patientRepository: Repository<Patient>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) {}

    async getOrCreate(input: NotificationPreferenceQueryInput): Promise<NotificationPreference> {
        this.validateScope(input);
        const where = input.patientId
            ? { patientId: input.patientId }
            : input.therapistId
                ? { therapistId: input.therapistId }
                : { userId: input.userId };
        let preference = await this.preferenceRepository.findOne({ where });
        if (preference) return preference;

        await this.assertScopeExists(input);
        preference = this.preferenceRepository.create({
            patientId: input.patientId || null,
            therapistId: input.therapistId || null,
            userId: input.userId || null,
            enabled: true,
            immediateEnabled: true,
            periodicEnabled: false,
            periodicEvery: 1,
            periodicUnit: NotificationPeriodicUnit.WEEKS,
            enabledEvents: this.defaultEvents,
            excludedRecipientIds: [],
        });
        return this.preferenceRepository.save(preference);
    }

    async update(input: UpdateNotificationPreferenceInput): Promise<NotificationPreference> {
        const preference = await this.getOrCreate(input);
        await this.validatePreferenceUpdate(input);
        Object.assign(preference, {
            enabled: input.enabled === undefined ? preference.enabled : input.enabled,
            immediateEnabled:
                input.immediateEnabled === undefined
                    ? preference.immediateEnabled
                    : input.immediateEnabled,
            periodicEnabled:
                input.periodicEnabled === undefined
                    ? preference.periodicEnabled
                    : input.periodicEnabled,
            periodicEvery: input.periodicEvery || preference.periodicEvery,
            periodicUnit: input.periodicUnit || preference.periodicUnit,
            enabledEvents: input.enabledEvents === undefined
                ? preference.enabledEvents
                : input.enabledEvents,
            excludedRecipientIds: input.excludedRecipientIds === undefined
                ? preference.excludedRecipientIds
                : input.excludedRecipientIds,
        });
        return this.preferenceRepository.save(preference);
    }

    isEventEnabled(preference: NotificationPreference, event: NotificationEvent): boolean {
        const enabledEvents = preference.enabledEvents === undefined || preference.enabledEvents === null
            ? this.defaultEvents
            : preference.enabledEvents;
        return preference.enabled && enabledEvents.includes(event);
    }

    isRecipientAllowed(preference: NotificationPreference, recipientId: number): boolean {
        return !(preference.excludedRecipientIds || []).includes(recipientId);
    }

    isPeriodicDue(preference: NotificationPreference, now = new Date()): boolean {
        if (!preference.enabled || !preference.periodicEnabled) return false;
        if (!preference.lastPeriodicSentAt) return true;
        return this.nextPeriodicDate(preference.lastPeriodicSentAt, preference) <= now;
    }

    periodStart(preference: NotificationPreference, now = new Date()): Date {
        const start = new Date(now);
        const amount = Math.max(1, preference.periodicEvery || 1);
        if (preference.periodicUnit === NotificationPeriodicUnit.MONTHS) {
            start.setMonth(start.getMonth() - amount);
        } else if (preference.periodicUnit === NotificationPeriodicUnit.WEEKS) {
            start.setDate(start.getDate() - amount * 7);
        } else {
            start.setDate(start.getDate() - amount);
        }
        return start;
    }

    private nextPeriodicDate(date: Date, preference: NotificationPreference): Date {
        const next = new Date(date);
        const amount = Math.max(1, preference.periodicEvery || 1);
        if (preference.periodicUnit === NotificationPeriodicUnit.MONTHS) {
            next.setMonth(next.getMonth() + amount);
        } else if (preference.periodicUnit === NotificationPeriodicUnit.WEEKS) {
            next.setDate(next.getDate() + amount * 7);
        } else {
            next.setDate(next.getDate() + amount);
        }
        return next;
    }

    private validateScope(input: NotificationPreferenceQueryInput): void {
        const selectedScopes = [input.patientId, input.therapistId, input.userId].filter(Boolean).length;
        if (selectedScopes !== 1) throw new BadRequestException('Select exactly one notification preference scope.');
    }

    private async validatePreferenceUpdate(input: UpdateNotificationPreferenceInput): Promise<void> {
        if (input.periodicEvery !== undefined && input.periodicEvery < 1) {
            throw new BadRequestException('Periodic frequency must be at least 1.');
        }
        if (input.enabledEvents) {
            const unsupportedEvents = input.enabledEvents.filter(
                event => !this.defaultEvents.includes(event),
            );
            if (unsupportedEvents.length) {
                throw new BadRequestException('One or more events cannot be configured at case level.');
            }
        }
        if (input.excludedRecipientIds?.length) {
            const responsibleIds = await this.resolveResponsibleRecipientIds(input);
            const invalidRecipientIds = input.excludedRecipientIds.filter(
                id => !responsibleIds.includes(id),
            );
            if (invalidRecipientIds.length) {
                throw new BadRequestException('Excluded recipients must be responsible users for this case.');
            }
        }
    }

    private async resolveResponsibleRecipientIds(input: NotificationPreferenceQueryInput): Promise<number[]> {
        if (input.patientId) {
            const patient = await this.patientRepository.findOne(input.patientId, {
                relations: ['caseManagers'],
            });
            return (patient?.caseManagers || []).map(user => user.id);
        }
        if (input.therapistId) {
            const therapist = await this.userRepository.findOne(input.therapistId, {
                relations: ['supervisors'],
            });
            return (therapist?.supervisors || []).map(user => user.id);
        }
        if (input.userId) return [input.userId];
        return [];
    }

    private async assertScopeExists(input: NotificationPreferenceQueryInput): Promise<void> {
        if (input.patientId && !(await this.patientRepository.findOne(input.patientId))) {
            throw new NotFoundException('Patient not found');
        }
        if (input.therapistId && !(await this.userRepository.findOne(input.therapistId))) {
            throw new NotFoundException('Therapist not found');
        }
        if (input.userId && !(await this.userRepository.findOne(input.userId))) {
            throw new NotFoundException('User not found');
        }
    }
}
