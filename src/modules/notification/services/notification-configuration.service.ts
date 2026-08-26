import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Department } from 'src/modules/department/models/department.model';
import { MailTemplate } from 'src/modules/mail/models/mail-template.model';
import { Patient } from 'src/modules/patient/models/patient.model';
import { Role } from 'src/modules/permission/models/role.model';
import { User } from 'src/modules/user/models/user.model';
import { Repository } from 'typeorm';
import {
    CreateNotificationConfigurationInput,
    UpdateNotificationConfigurationInput,
} from '../dtos/notification-configuration.input';
import { NotificationTemplateShortcutDto } from '../dtos/notification-template-shortcut.dto';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { NotificationEvent } from '../enums/notification-event.enum';
import { NotificationFamily } from '../enums/notification-family.enum';
import { NotificationConfiguration } from '../models/notification-configuration.model';
import { NotificationPreferenceService } from './notification-preference.service';

@Injectable()
export class NotificationConfigurationService {
    constructor(
        @InjectRepository(NotificationConfiguration)
        private readonly configurationRepository: Repository<NotificationConfiguration>,
        @InjectRepository(Department)
        private readonly departmentRepository: Repository<Department>,
        @InjectRepository(Role)
        private readonly roleRepository: Repository<Role>,
        @InjectRepository(MailTemplate)
        private readonly mailTemplateRepository: Repository<MailTemplate>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Patient)
        private readonly patientRepository: Repository<Patient>,
        private readonly preferenceService: NotificationPreferenceService,
    ) {}

    list(): Promise<NotificationConfiguration[]> {
        return this.configurationRepository.find({
            relations: ['department', 'recipientRole', 'mailTemplate'],
            order: { id: 'DESC' },
        });
    }

    async get(id: number): Promise<NotificationConfiguration> {
        const configuration = await this.configurationRepository.findOne(id, {
            relations: ['department', 'recipientRole', 'mailTemplate'],
        });
        if (!configuration) throw new NotFoundException('Notification configuration not found');
        return configuration;
    }

    async create(input: CreateNotificationConfigurationInput): Promise<NotificationConfiguration> {
        await this.validateInput(input);
        await this.assertUniqueScope(input);
        const configuration = this.configurationRepository.create({
            ...input,
            departmentId: input.departmentId || null,
            mailTemplateId: input.mailTemplateId || null,
            active: input.active !== false,
        });
        const saved = await this.configurationRepository.save(configuration);
        return this.get(saved.id);
    }

    async update(input: UpdateNotificationConfigurationInput): Promise<NotificationConfiguration> {
        const configuration = await this.get(input.id);
        const next = {
            departmentId: input.departmentId === undefined ? configuration.departmentId : input.departmentId || null,
            channel: input.channel || configuration.channel,
            family: input.family || configuration.family,
            event: input.event || configuration.event,
            recipientRoleId: input.recipientRoleId || configuration.recipientRoleId,
            mailTemplateId: input.mailTemplateId === undefined ? configuration.mailTemplateId : input.mailTemplateId || null,
            active: input.active === undefined ? configuration.active : input.active,
            notes: input.notes === undefined ? configuration.notes : input.notes,
        };
        await this.validateInput(next);
        await this.assertUniqueScope(next, input.id);
        Object.assign(configuration, next);
        await this.configurationRepository.save(configuration);
        return this.get(configuration.id);
    }

    async delete(id: number): Promise<boolean> {
        await this.configurationRepository.delete(id);
        return true;
    }

    templateShortcuts(): NotificationTemplateShortcutDto[] {
        return [
            { group: 'Compatibilidad', label: 'Nombre', token: '{{firstName}}', description: 'Alias legacy del nombre del destinatario.' },
            { group: 'Compatibilidad', label: 'Usuario', token: '{{username}}', description: 'Usuario de acceso, usado principalmente en emails de bienvenida.' },
            { group: 'Compatibilidad', label: 'Contraseña', token: '{{password}}', description: 'Contraseña temporal, usada principalmente en emails de bienvenida.' },
            { group: 'Compatibilidad', label: 'Link', token: '{{link}}', description: 'Alias legacy del link principal del email.' },
            { group: 'Compatibilidad', label: 'URL de login', token: '{{loginUrl}}', description: 'Acceso a la pantalla de login de PSIRA.' },
            { group: 'Usuario', label: 'Nombre', token: '{{user.firstName}}', description: 'Nombre del usuario vinculado al evento.' },
            { group: 'Usuario', label: 'Nombre completo', token: '{{user.fullName}}', description: 'Nombre completo del usuario vinculado al evento.' },
            { group: 'Usuario', label: 'Email', token: '{{user.email}}', description: 'Email del usuario vinculado al evento.' },
            { group: 'Usuario', label: 'Último login', token: '{{user.lastLoginAt}}', description: 'Fecha del último ingreso registrado.' },
            { group: 'Usuario', label: 'Login anterior', token: '{{user.previousLastLoginAt}}', description: 'Fecha del ingreso anterior al último login.' },
            { group: 'Destinatario', label: 'Nombre', token: '{{recipient.firstName}}', description: 'Nombre de quien recibe la notificación.' },
            { group: 'Destinatario', label: 'Usuario', token: '{{recipient.username}}', description: 'Usuario de acceso del destinatario.' },
            { group: 'Destinatario', label: 'Nombre completo', token: '{{recipient.fullName}}', description: 'Nombre completo de quien recibe la notificación.' },
            { group: 'Destinatario', label: 'Email', token: '{{recipient.email}}', description: 'Email del destinatario.' },
            { group: 'Caso', label: 'Nombre del paciente', token: '{{patient.fullName}}', description: 'Nombre completo del paciente/caso.' },
            { group: 'Caso', label: 'Número de historia', token: '{{patient.medicalRecordNo}}', description: 'Identificador clínico del paciente.' },
            { group: 'Caso', label: 'Administrador del caso', token: '{{caseManager.fullName}}', description: 'Administrador de caso asociado.' },
            { group: 'Supervisión', label: 'Terapeuta', token: '{{therapist.fullName}}', description: 'Terapeuta asociado a una supervisión.' },
            { group: 'Supervisión', label: 'Supervisor', token: '{{supervisor.fullName}}', description: 'Supervisor asociado.' },
            { group: 'Evaluación', label: 'Nombre', token: '{{assessment.name}}', description: 'Nombre o tipo de evaluación.' },
            { group: 'Evaluación', label: 'Fecha de envío', token: '{{assessment.deliveryDate}}', description: 'Fecha en la que se habilita la evaluación.' },
            { group: 'Evaluación', label: 'Fecha de vencimiento', token: '{{assessment.expirationDate}}', description: 'Fecha de vencimiento de la evaluación.' },
            { group: 'Evaluación', label: 'Estado', token: '{{assessment.responseStatus}}', description: 'Estado de respuesta de la evaluación.' },
            { group: 'Evaluación', label: 'Link de respuesta', token: '{{assessment.link}}', description: 'Acceso directo para responder la evaluación.' },
            { group: 'Sesión', label: 'Número', token: '{{session.number}}', description: 'Número de sesión vinculado al evento.' },
            { group: 'Sesión', label: 'Fecha', token: '{{session.date}}', description: 'Fecha de la sesión vinculada al evento.' },
            { group: 'Motivo', label: 'Motivo', token: '{{reason.label}}', description: 'Motivo seleccionado en el árbol correspondiente.' },
            { group: 'Motivo', label: 'Nota clínica', token: '{{reason.note}}', description: 'Nota clínica o de supervisión escrita al registrar el evento.' },
            { group: 'Resumen periódico', label: 'Inicio del período', token: '{{period.start}}', description: 'Fecha inicial incluida en el resumen.' },
            { group: 'Resumen periódico', label: 'Fin del período', token: '{{period.end}}', description: 'Fecha final incluida en el resumen.' },
            { group: 'Resumen periódico', label: 'Tabla de evaluaciones', token: '{{assessmentsTable}}', description: 'Tabla renderizada con evaluaciones del período.' },
        ];
    }

    async resolveAssessmentAssignedMailTemplate(input: {
        responderUserId: number;
        patientId?: number;
        targetUserId?: number;
    }): Promise<MailTemplate | null> {
        const configuration = await this.resolveMailConfigurationForRecipient({
            event: NotificationEvent.ASSESSMENT_ASSIGNED,
            recipientUserId: input.responderUserId,
            patientId: input.patientId,
            targetUserId: input.targetUserId,
        });
        return configuration?.mailTemplate || null;
    }

    async resolveAssessmentReminderMailTemplate(input: {
        responderUserId: number;
        patientId?: number;
        targetUserId?: number;
    }): Promise<MailTemplate | null> {
        const configuration = await this.resolveMailConfigurationForRecipient({
            event: NotificationEvent.ASSESSMENT_REMINDER,
            recipientUserId: input.responderUserId,
            patientId: input.patientId,
            targetUserId: input.targetUserId,
        });
        return configuration?.mailTemplate || null;
    }

    async resolveMailConfigurationForRecipient(input: {
        event: NotificationEvent;
        recipientUserId: number;
        patientId?: number;
        targetUserId?: number;
    }): Promise<NotificationConfiguration | null> {
        const responder = await this.userRepository.findOne(input.recipientUserId, {
            relations: ['roles', 'departments'],
        });
        if (!responder?.roles?.length) return null;

        const userPreference = await this.preferenceService.getOrCreate({ userId: responder.id });
        if (
            !userPreference.enabled ||
            !userPreference.immediateEnabled ||
            !this.preferenceService.isEventEnabled(userPreference, input.event)
        ) {
            return null;
        }

        const roleIds = responder.roles.map(role => role.id);
        const departmentIds = await this.resolveContextDepartmentIds(input, responder);

        const query = this.configurationRepository
            .createQueryBuilder('configuration')
            .leftJoinAndSelect('configuration.mailTemplate', 'mailTemplate')
            .where('configuration.active = true')
            .andWhere('configuration.channel = :channel', { channel: NotificationChannel.EMAIL })
            .andWhere('configuration.event = :event', {
                event: input.event,
            })
            .andWhere('configuration."recipientRoleId" IN (:...roleIds)', { roleIds })
            .andWhere('configuration."mailTemplateId" IS NOT NULL');

        if (departmentIds.length) {
            query.andWhere(
                '(configuration."departmentId" IN (:...departmentIds) OR configuration."departmentId" IS NULL)',
                { departmentIds },
            );
        } else {
            query.andWhere('configuration."departmentId" IS NULL');
        }

        const configuration = await query
            .orderBy(
                'CASE WHEN configuration."departmentId" IS NULL THEN 1 ELSE 0 END',
                'ASC',
            )
            .addOrderBy('configuration.id', 'ASC')
            .getOne();

        return configuration || null;
    }

    private async validateInput(input: Partial<CreateNotificationConfigurationInput>): Promise<void> {
        if (!input.channel) throw new BadRequestException('Channel is required');
        if (!input.family) throw new BadRequestException('Family is required');
        if (!input.event) throw new BadRequestException('Event is required');
        if (!input.recipientRoleId) throw new BadRequestException('Recipient role is required');
        if (input.family !== this.eventFamily(input.event)) {
            throw new BadRequestException('Notification family does not match the selected event.');
        }
        if (input.channel === NotificationChannel.EMAIL && input.active !== false && !input.mailTemplateId) {
            throw new BadRequestException('Mail template is required for active email notifications');
        }
        if (input.departmentId) {
            const department = await this.departmentRepository.findOne(input.departmentId);
            if (!department) throw new NotFoundException('Department not found');
        }
        const role = await this.roleRepository.findOne(input.recipientRoleId);
        if (!role) throw new NotFoundException('Recipient role not found');
        if (input.mailTemplateId) {
            const template = await this.mailTemplateRepository.findOne(input.mailTemplateId);
            if (!template) throw new NotFoundException('Mail template not found');
        }
    }

    private async assertUniqueScope(
        input: Partial<CreateNotificationConfigurationInput>,
        ignoreId?: number,
    ): Promise<void> {
        const query = this.configurationRepository
            .createQueryBuilder('configuration')
            .where('configuration."channel" = :channel', { channel: input.channel })
            .andWhere('configuration."event" = :event', { event: input.event })
            .andWhere('configuration."recipientRoleId" = :recipientRoleId', {
                recipientRoleId: input.recipientRoleId,
            });

        if (input.departmentId) {
            query.andWhere('configuration."departmentId" = :departmentId', {
                departmentId: input.departmentId,
            });
        } else {
            query.andWhere('configuration."departmentId" IS NULL');
        }
        if (ignoreId) query.andWhere('configuration.id != :ignoreId', { ignoreId });

        if (await query.getCount()) {
            throw new BadRequestException(
                'Ya existe una configuración para ese departamento, canal, evento y rol destinatario.',
            );
        }
    }

    private async resolveContextDepartmentIds(
        input: { patientId?: number; targetUserId?: number },
        responder: User,
    ): Promise<number[]> {
        if (input.patientId) {
            const patient = await this.patientRepository.findOne(input.patientId, {
                relations: ['departments'],
            });
            if (patient?.departments?.length) {
                return patient.departments.map(department => department.id);
            }
        }

        if (input.targetUserId) {
            const targetUser = await this.userRepository.findOne(input.targetUserId, {
                relations: ['departments'],
            });
            if (targetUser?.departments?.length) {
                return targetUser.departments.map(department => department.id);
            }
        }

        return (responder.departments || []).map(department => department.id);
    }

    private eventFamily(event: NotificationEvent): NotificationFamily {
        if (event.startsWith('ASSESSMENT_')) return NotificationFamily.ASSESSMENT;
        if (event.startsWith('CASE_')) return NotificationFamily.CASE;
        return NotificationFamily.AUTOMATION;
    }
}
