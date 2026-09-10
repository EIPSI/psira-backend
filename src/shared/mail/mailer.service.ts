import { Injectable } from '@nestjs/common';
import { configService } from 'src/config/config.service';

const nodemailer = require('nodemailer');

export interface SendMailOptions {
    to: string;
    from?: string;
    subject: string;
    html: string;
}

@Injectable()
export class MailerService {
    private readonly transporter = nodemailer.createTransport(configService.getMailerConfig().transport);

    async sendMail(options: SendMailOptions): Promise<any> {
        return this.transporter.sendMail(options);
    }
}
