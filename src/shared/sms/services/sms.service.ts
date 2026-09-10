import { Injectable } from '@nestjs/common';
import { infobipConfig } from 'src/config/infobip.config';
import { SendSMSDto } from '../dtos/SendSMS.dto';
import * as http from 'http';
import * as https from 'https';

@Injectable()
export class SmsService {

    async sendSms(smsDto: SendSMSDto): Promise<void> {
        await this.sendInfobipSMS(smsDto);
    }


    protected async sendInfobipSMS(smsDto: SendSMSDto): Promise<any> {

        return new Promise((resolve, reject) => {

            const { to, from, message } = smsDto;

            const baseUrl = new URL(infobipConfig.baseUrl || 'https://api.infobip.com');
            const data = JSON.stringify({ from: from, to: to, text: message });
            const authorization = Buffer.from(`${infobipConfig.username}:${infobipConfig.password}`).toString('base64');
            const transport = baseUrl.protocol === 'http:' ? http : https;

            const request = transport.request(
                {
                    method: 'POST',
                    hostname: baseUrl.hostname,
                    port: baseUrl.port || undefined,
                    path: '/sms/1/text/single',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(data),
                        Authorization: `Basic ${authorization}`,
                    },
                },
                (response) => {
                    const chunks: Buffer[] = [];

                    response.on('data', (chunk) => chunks.push(chunk));
                    response.on('end', () => {
                        const body = Buffer.concat(chunks).toString('utf8');
                        if (response.statusCode !== 200) {
                            const error = new Error(body || 'Unable to send SMS');
                            error['code'] = response.statusCode;
                            reject(error);
                            return;
                        }

                        resolve(body ? JSON.parse(body) : {});
                    });
                },
            );

            request.on('error', reject);
            request.write(data);
            request.end();

        });

    }

}
