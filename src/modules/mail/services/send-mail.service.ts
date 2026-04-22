import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Assessment } from 'src/modules/assessment/models/assessment.model';
import { Repository } from 'typeorm';
import { AssessmentEmailStatus } from 'src/modules/assessment/enums/assessment-emailstatus.enum';
import Handlebars from 'handlebars';
import * as CryptoJS from 'crypto-js';
import { url } from '../../../shared';
import { configService } from 'src/config/config.service';
import { QuestionnaireAssessmentService } from 'src/modules/questionnaire/services/questionnaire-assessment.service';
import { AssessmentStatus } from 'src/modules/questionnaire/enums/assessment-status.enum';
import { User } from 'src/modules/user/models/user.model';

@Injectable()
export class SendMailService {
    constructor(
        private questionnaireAssessmentService: QuestionnaireAssessmentService,
        private mailerService: MailerService,
        @InjectRepository(Assessment)
        private assessmentRepository: Repository<Assessment>,
    ) {}

    @Cron(CronExpression.EVERY_MINUTE)
    async checkAssessmentEmails() {
        try {
            const selectAssessment = await this.assessmentRepository
                .createQueryBuilder('assessment')
                .leftJoinAndSelect('assessment.mailTemplate', 'mailTemplate')
                .where(
                    `(Extract(epoch FROM (assessment.deliveryDate - now()))/60)::integer <= 0 
                    AND assessment.emailStatus = 'SCHEDULED'`,
                )
                .getMany();

            selectAssessment.map(async assessmentInfo => {
                await this.sendEmail(assessmentInfo);
            });
        } catch (error) {
            return error;
        }
    }

    async sendAssessmentEmail(id: number) {
        try {
            const assessment = await this.assessmentRepository.findOneOrFail({
                where: { id },
                relations: ['mailTemplate'],
            });

            if (!assessment.mailTemplate) {
                throw new Error('Mail template not found!');
            }

            if (!assessment.emailReminder || !assessment.receiverEmail) {
                throw new Error('Email is required!');
            }

            await this.sendEmail(assessment);
            return true;
        } catch (error) {
            return error;
        }
    }

    async sendEmail(assessmentInfo: Assessment) {
        const mailTemplate = assessmentInfo.mailTemplate;

        const questionnaireAssessment = await this.questionnaireAssessmentService.getById(
            assessmentInfo.questionnaireAssessmentId.toString(),
        );

        if (
            questionnaireAssessment.status === AssessmentStatus.CANCELLED ||
            (assessmentInfo.expirationDate && new Date(assessmentInfo.expirationDate) < new Date()) ||
            assessmentInfo.deleted ||
            !mailTemplate
        ) {
            return await this.assessmentRepository.update(assessmentInfo.id, {
                emailStatus: AssessmentEmailStatus.FAILED,
            });
        }

        Handlebars.registerHelper('helperMissing', function(val) {
            if (val === undefined) {
                return null;
            }
            return val;
        });

        const template = Handlebars.compile(mailTemplate.body);

        const url = this.generateAssessmentURL(assessmentInfo.uuid);

        const templateData = {
            // name: assessmentInfo.patient.firstName,
            link: url,
        };

        await this.mailerService
            .sendMail({
                to: assessmentInfo.receiverEmail,
                from: configService.getSenderMail(),
                subject: mailTemplate.subject,
                html: template(templateData),
            })
            .then(async () => {
                await this.assessmentRepository.update(assessmentInfo.id, {
                    emailStatus: AssessmentEmailStatus.SENT,
                });
            })
            .catch(async () => {
                await this.assessmentRepository.update(assessmentInfo.id, {
                    emailStatus: AssessmentEmailStatus.FAILED,
                });
            });
    }

    private generateAssessmentURL(assesmentUuid: string): string {
        const secretKey = configService.getFrontendEncryptionKey();

        const cryptoId = CryptoJS.AES.encrypt(
            assesmentUuid,
            secretKey,
        ).toString();

        return url(
            `assessment/overview?assessment=${encodeURIComponent(cryptoId)}`,
        );
    }

    /**
     * Send welcome email to new patients/caregivers with temporary credentials
     */
    async sendWelcomeEmail(user: User, tempPassword: string): Promise<boolean> {
        try {
            // Compile HTML template with Handlebars
            const template = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Bienvenido a PSIRA - Tu cuenta de acceso</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: #4a90e2; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 5px; margin-top: 20px; }
                        .button { display: inline-block; background: #4a90e2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; }
                        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                        .credentials { background: #fff; padding: 15px; border: 2px solid #4a90e2; border-radius: 5px; margin: 20px 0; }
                        .credentials p { margin: 5px 0; }
                        .label { font-weight: bold; color: #4a90e2; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Bienvenido a PSIRA</h1>
                            <p>Tu cuenta de acceso está lista</p>
                        </div>
                        <div class="content">
                            <h2>Hola {{{firstName}}}!</h2>
                            <p>Se ha creado una cuenta para que puedas acceder a tu portal de salud, ver tus próximas sesiones y completar evaluaciones.</p>
                            
                            <div class="credentials">
                                <p><span class="label">Usuario:</span> {{{username}}}</p>
                                <p><span class="label">Contraseña Temporal:</span> {{{password}}}</p>
                            </div>
                            
                            <p style="text-align: center; margin-top: 30px;">
                                <a href="{{loginUrl}}" class="button">Acceder a mi Portal</a>
                            </p>
                            
                            <p><strong>Nota de seguridad:</strong> Por seguridad, se te pedirá cambiar esta contraseña en tu primer ingreso.</p>
                        </div>
                        <div class="footer">
                            <p>Este es un correo automático, por favor no responder.</p>
                            <p>&copy; 2024 PSIRA - Todos los derechos reservados.</p>
                        </div>
                    </div>
                </body>
                </html>
            `;

            const templateFn = Handlebars.compile(template);
            const html = templateFn({
                firstName: user.firstName,
                username: user.username,
                password: tempPassword,
                loginUrl: this.getLoginUrl(),
            });

            // Send email using MailerService
            await this.mailerService.sendMail({
                to: user.email,
                from: process.env.EMAIL_SENDER || 'noreply@psira.com',
                subject: 'Bienvenido a PSIRA - Tu cuenta de acceso',
                html: html,
            });

            console.log(`Welcome email sent to ${user.email}`);
            return true;
        } catch (error) {
            console.error('Error sending welcome email:', error);
            return false;
        }
    }

    private getLoginUrl(): string {
        // TODO: Obtener URL del frontend desde configuración
        // Por ahora, usar un valor por defecto o leer desde .env
        return process.env.FRONTEND_URL || 'https://psira.localhost:8443/auth/login';
    }
}
