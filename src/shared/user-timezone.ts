import * as moment from 'moment-timezone';

export function userTimezone(user?: { timezone?: string; detectedTimezone?: string }, fallback = 'UTC'): string {
    for (const timezone of [user?.timezone, user?.detectedTimezone]) {
        if (timezone && moment.tz.zone(timezone)) return timezone;
    }
    return moment.tz.zone(fallback) ? fallback : 'UTC';
}
