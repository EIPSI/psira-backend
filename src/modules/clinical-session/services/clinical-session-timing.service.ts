import { Injectable } from '@nestjs/common';
import { ResourceActivationAnchor } from 'src/modules/evaluation-scheme/enums/resource-activation-anchor.enum';

export interface ResourceTimingOptions {
    sessionStartAt: Date;
    sessionEndAt: Date;
    activationAnchor: ResourceActivationAnchor;
    activationOffsetMinutes: number;
    availabilityDurationMinutes: number;
}

export interface ResourceTimingWindow {
    activationAt: Date;
    expirationAt: Date;
}

@Injectable()
export class ClinicalSessionTimingService {
    calculateResourceWindow(options: ResourceTimingOptions): ResourceTimingWindow {
        const anchor =
            options.activationAnchor === ResourceActivationAnchor.SESSION_END
                ? options.sessionEndAt
                : options.sessionStartAt;

        const activationAt = this.addMinutes(
            anchor,
            options.activationOffsetMinutes,
        );

        return {
            activationAt,
            expirationAt: this.addMinutes(
                activationAt,
                options.availabilityDurationMinutes,
            ),
        };
    }

    getDefaultPreAssessmentWindow(
        sessionStartAt: Date,
        sessionEndAt: Date,
    ): ResourceTimingWindow {
        return this.calculateResourceWindow({
            sessionStartAt,
            sessionEndAt,
            activationAnchor: ResourceActivationAnchor.SESSION_START,
            activationOffsetMinutes: -15,
            availabilityDurationMinutes: 30,
        });
    }

    getDefaultPostAssessmentWindow(
        sessionStartAt: Date,
        sessionEndAt: Date,
    ): ResourceTimingWindow {
        return this.calculateResourceWindow({
            sessionStartAt,
            sessionEndAt,
            activationAnchor: ResourceActivationAnchor.SESSION_END,
            activationOffsetMinutes: -5,
            availabilityDurationMinutes: 60,
        });
    }

    private addMinutes(date: Date, minutes: number): Date {
        return new Date(date.getTime() + minutes * 60 * 1000);
    }
}
