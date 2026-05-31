import { Injectable } from '@nestjs/common';
import * as https from 'https';
import { URLSearchParams } from 'url';

@Injectable()
export class GoogleCalendarHttpService {
    async postForm<T>(url: string, form: Record<string, string>): Promise<T> {
        return this.request<T>(
            'POST',
            url,
            new URLSearchParams(form).toString(),
            { 'Content-Type': 'application/x-www-form-urlencoded' },
        );
    }

    async postJson<T>(url: string, body: any, accessToken: string): Promise<T> {
        return this.request<T>(
            'POST',
            url,
            JSON.stringify(body),
            {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        );
    }

    async patchJson<T>(url: string, body: any, accessToken: string): Promise<T> {
        return this.request<T>(
            'PATCH',
            url,
            JSON.stringify(body),
            {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        );
    }

    async getJson<T>(url: string, accessToken: string): Promise<T> {
        return this.request<T>('GET', url, undefined, {
            Authorization: `Bearer ${accessToken}`,
        });
    }

    private request<T>(
        method: string,
        url: string,
        body?: string,
        headers: Record<string, string> = {},
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            const req = https.request(url, { method, headers }, res => {
                let data = '';
                res.on('data', chunk => (data += chunk));
                res.on('end', () => {
                    const parsed = data ? JSON.parse(data) : {};
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                        return;
                    }
                    reject(new Error(parsed.error_description || parsed.error || data));
                });
            });
            req.on('error', reject);
            if (body) req.write(body);
            req.end();
        });
    }
}
