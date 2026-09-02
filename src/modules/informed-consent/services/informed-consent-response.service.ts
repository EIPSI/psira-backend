import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RoleCode } from 'src/modules/permission/enums/role-code.enum';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { Patient } from 'src/modules/patient/models/patient.model';
import { User } from 'src/modules/user/models/user.model';
import { NotificationDispatchService } from 'src/modules/notification/services/notification-dispatch.service';
import { NotificationEvent } from 'src/modules/notification/enums/notification-event.enum';
import { SettingKey } from 'src/modules/setting/enums/setting-name.enum';
import { SettingService } from 'src/modules/setting/providers/setting.service';
import { url } from 'src/shared';
import { configService } from 'src/config/config.service';
import * as CryptoJS from 'crypto-js';
import { Repository } from 'typeorm';
import { PendingInformedConsentDto } from '../dtos/pending-informed-consent.dto';
import {
    CancelInformedConsentReactivationInput,
    ReviewInformedConsentResponseInput,
    SubmitInformedConsentResponseInput,
} from '../dtos/informed-consent-response.input';
import { InformedConsentAnswerResolution } from '../enums/informed-consent-answer-resolution.enum';
import { InformedConsentManagementStatus } from '../enums/informed-consent-management-status.enum';
import { InformedConsentResponseStatus } from '../enums/informed-consent-response-status.enum';
import { InformedConsentReviewAction } from '../enums/informed-consent-review-action.enum';
import { InformedConsentTrigger } from '../enums/informed-consent-trigger.enum';
import { InformedConsentAnswerOption } from '../models/informed-consent-answer-option.model';
import { InformedConsentManagement } from '../models/informed-consent-management.model';
import { InformedConsentModel } from '../models/informed-consent-model.model';
import { InformedConsentResponseAnswer } from '../models/informed-consent-response-answer.model';
import { InformedConsentResponse } from '../models/informed-consent-response.model';
import { InformedConsentReview } from '../models/informed-consent-review.model';

@Injectable()
export class InformedConsentResponseService {
    constructor(
        @InjectRepository(InformedConsentManagement)
        private readonly managementRepository: Repository<InformedConsentManagement>,
        @InjectRepository(InformedConsentModel)
        private readonly modelRepository: Repository<InformedConsentModel>,
        @InjectRepository(InformedConsentResponse)
        private readonly responseRepository: Repository<InformedConsentResponse>,
        @InjectRepository(InformedConsentResponseAnswer)
        private readonly responseAnswerRepository: Repository<InformedConsentResponseAnswer>,
        @InjectRepository(InformedConsentAnswerOption)
        private readonly answerOptionRepository: Repository<InformedConsentAnswerOption>,
        @InjectRepository(InformedConsentReview)
        private readonly reviewRepository: Repository<InformedConsentReview>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Patient)
        private readonly patientRepository: Repository<Patient>,
        private readonly notificationDispatchService: NotificationDispatchService,
        private readonly settingService: SettingService,
    ) {}

    listResponses(): Promise<InformedConsentResponse[]> {
        return this.responseRepository.find({
            relations: ['management', 'model', 'version', 'version.textBlocks', 'version.questions', 'version.questions.answerOptions', 'signer', 'representedUser', 'patient', 'answers', 'reviews'],
            order: { id: 'DESC' },
        });
    }

    listResponsesForUser(userId: number): Promise<InformedConsentResponse[]> {
        return this.responseRepository.find({
            where: [
                { signerUserId: userId },
                { representedUserId: userId },
            ],
            relations: ['management', 'model', 'version', 'version.textBlocks', 'version.questions', 'version.questions.answerOptions', 'signer', 'representedUser', 'patient', 'answers', 'reviews'],
            order: { id: 'DESC' },
        });
    }

    async getResponse(id: number): Promise<InformedConsentResponse> {
        const response = await this.responseRepository.findOne(id, {
            relations: ['management', 'model', 'version', 'version.textBlocks', 'version.questions', 'version.questions.answerOptions', 'signer', 'representedUser', 'patient', 'answers', 'reviews'],
        });
        if (!response) throw new NotFoundException('Informed consent response not found.');
        return response;
    }

    async pendingForUser(userId: number): Promise<PendingInformedConsentDto[]> {
        const informedConsentEnabled = await this.settingService.getKey(SettingKey.INFORMED_CONSENT_ENABLED);
        if (informedConsentEnabled === false) return [];
        const user = await this.loadUserScope(userId);
        if (!user) return [];
        const applicable = await this.applicableManagements(user);
        const pending: PendingInformedConsentDto[] = [];
        for (const management of applicable) {
            if (!await this.triggerAppliesToUser(management, user)) continue;
            const latest = await this.latestResponse(user.id, management.id);
            if (this.isSatisfied(management, latest)) continue;
            pending.push({
                managementId: management.id,
                modelId: management.modelId,
                versionId: management.model.currentPublishedVersionId,
                title: management.title,
                kind: management.model.kind,
                trigger: management.trigger,
                mandatory: management.mandatory,
                blocking: latest?.status === InformedConsentResponseStatus.BLOCKED,
                responseId: latest?.id,
                responseStatus: latest?.status,
            });
        }
        return pending;
    }

    async getPendingModelForUser(
        userId: number,
        modelId: number,
    ): Promise<InformedConsentModel> {
        const pending = await this.pendingForUser(userId);
        const isPending = pending.some(item => Number(item.modelId) === Number(modelId) && !item.blocking);
        if (!isPending) {
            throw new ForbiddenException('This informed consent model is not pending for the current user.');
        }
        const model = await this.modelRepository.findOne(modelId, {
            relations: [
                'departments',
                'currentPublishedVersion',
                'currentPublishedVersion.textBlocks',
                'currentPublishedVersion.questions',
                'currentPublishedVersion.questions.answerOptions',
            ],
        });
        if (!model) throw new NotFoundException('Informed consent model not found.');
        return model;
    }

    public publicResponseLinkForUser(userId: number): string {
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 6);
        const token = CryptoJS.AES.encrypt(
            JSON.stringify({ userId, exp: expiresAt.getTime() }),
            configService.getFrontendEncryptionKey(),
        ).toString();
        return url(`informed-consent/pending?token=${encodeURIComponent(token)}`);
    }

    async pendingForPublicToken(token: string): Promise<PendingInformedConsentDto[]> {
        const payload = this.publicTokenPayload(token);
        return this.pendingForUser(payload.userId);
    }

    async getPendingModelForPublicToken(
        token: string,
        modelId: number,
    ): Promise<InformedConsentModel> {
        const payload = this.publicTokenPayload(token);
        return this.getPendingModelForUser(payload.userId, modelId);
    }

    async submitPublic(
        token: string,
        input: SubmitInformedConsentResponseInput,
        request?: { ip?: string; headers?: any },
    ): Promise<InformedConsentResponse> {
        const payload = this.publicTokenPayload(token);
        const user = await this.userRepository.findOne(payload.userId);
        if (!user) throw new NotFoundException('User not found for informed consent token.');
        return this.submit(input, user, request);
    }

    private publicTokenPayload(token: string): { userId: number; exp: number } {
        try {
            const decrypted = CryptoJS.AES.decrypt(
                decodeURIComponent(token),
                configService.getFrontendEncryptionKey(),
            ).toString(CryptoJS.enc.Utf8);
            const payload = JSON.parse(decrypted);
            if (!payload?.userId || !payload?.exp || Number(payload.exp) < Date.now()) {
                throw new Error('Invalid or expired informed consent token.');
            }
            return { userId: Number(payload.userId), exp: Number(payload.exp) };
        } catch {
            throw new ForbiddenException('Invalid or expired informed consent token.');
        }
    }

    private async triggerAppliesToUser(
        management: InformedConsentManagement,
        user: User,
    ): Promise<boolean> {
        switch (management.trigger) {
            case InformedConsentTrigger.USER_CREATED:
                return true;
            case InformedConsentTrigger.FIRST_LOGIN:
                return true;
            case InformedConsentTrigger.NEW_TREATMENT:
                return this.userHasSubsequentTreatmentCycle(user);
            case InformedConsentTrigger.CONSENT_VERSION_CHANGED:
                return this.userHasOutdatedResponseForModel(user.id, management);
            default:
                return false;
        }
    }

    private async userHasSubsequentTreatmentCycle(user: User): Promise<boolean> {
        if (!user.firstLoginAt) return false;
        const rows = await this.responseRepository.manager.query(
            `
            SELECT cycle.id
            FROM treatment_cycle cycle
            LEFT JOIN patient patient ON patient.id = cycle."patientId"
            WHERE cycle."cycleNumber" >= 2
              AND cycle."startedAt" >= $2
              AND (
                patient."userId" = $1
                OR cycle."therapistId" = $1
              )
            LIMIT 1
            `,
            [user.id, user.firstLoginAt],
        );
        return rows.length > 0;
    }

    private async userHasOutdatedResponseForModel(
        userId: number,
        management: InformedConsentManagement,
    ): Promise<boolean> {
        const latestForModel = await this.responseRepository.findOne({
            where: {
                signerUserId: userId,
                modelId: management.modelId,
            },
            order: { createdAt: 'DESC' },
        });
        return !!latestForModel
            && Number(latestForModel.versionId) !== Number(management.model?.currentPublishedVersionId);
    }

    async hasBlockingPending(userId: number): Promise<boolean> {
        const pending = await this.pendingForUser(userId);
        return pending.some(item => item.blocking);
    }

    async submit(
        input: SubmitInformedConsentResponseInput,
        currentUser: User,
        request?: { ip?: string; headers?: any },
    ): Promise<InformedConsentResponse> {
        const management = await this.managementRepository.findOne(input.managementId, {
            relations: [
                'model',
                'departments',
                'roles',
                'model.currentPublishedVersion',
                'model.currentPublishedVersion.textBlocks',
                'model.currentPublishedVersion.questions',
                'model.currentPublishedVersion.questions.answerOptions',
            ],
        });
        if (!management) throw new NotFoundException('Informed consent management not found.');
        if (!management.model?.currentPublishedVersionId) {
            throw new NotFoundException('Informed consent management has no published version.');
        }
        const user = await this.loadUserScope(currentUser.id);
        if (!await this.managementAppliesToUser(management, user)) {
            throw new ForbiddenException('This informed consent does not apply to the current user.');
        }
        const optionIds = input.answers
            .map(answer => answer.answerOptionId)
            .filter((id): id is number => !!id);
        const options = optionIds.length
            ? await this.answerOptionRepository.findByIds(optionIds)
            : [];
        const finalResolution = this.resolveFinalResolution(options.map(option => option.resolution));
        const blocked = options.some(option => option.blocksUsageOnSelection);
        const patientId = input.patientId || await this.resolvePatientIdForSigner(currentUser.id);
        const response = await this.responseRepository.save(this.responseRepository.create({
            managementId: management.id,
            modelId: management.modelId,
            versionId: management.model.currentPublishedVersionId,
            signerUserId: currentUser.id,
            representedUserId: input.representedUserId,
            patientId,
            status: blocked
                ? InformedConsentResponseStatus.BLOCKED
                : InformedConsentResponseStatus.SUBMITTED,
            finalResolution,
            mandatorySnapshot: management.mandatory,
            modelSnapshot: this.modelSnapshot(management),
            responseSnapshot: input.answers,
            answeredAt: new Date(),
            blockedAt: blocked ? new Date() : undefined,
            ipAddress: request?.ip,
            userAgent: request?.headers?.['user-agent'],
            language: input.language,
        }));
        for (const answer of input.answers) {
            const option = answer.answerOptionId
                ? options.find(candidate => candidate.id === answer.answerOptionId)
                : undefined;
            await this.responseAnswerRepository.save(this.responseAnswerRepository.create({
                responseId: response.id,
                questionId: answer.questionId,
                answerOptionId: answer.answerOptionId,
                valueText: answer.valueText,
                valueJson: answer.valueJson ? JSON.parse(answer.valueJson) : undefined,
                resolution: option?.resolution,
            }));
        }
        await this.dispatchConsentNotification(
            blocked ? NotificationEvent.INFORMED_CONSENT_REJECTED : NotificationEvent.INFORMED_CONSENT_SUBMITTED,
            response.id,
        );
        return this.getResponse(response.id);
    }

    async reactivate(
        input: ReviewInformedConsentResponseInput,
        currentUser: User,
    ): Promise<InformedConsentResponse> {
        const responseId = Number(input.responseId);
        if (!responseId) {
            throw new BadRequestException('responseId is required to reactivate an informed consent response.');
        }
        const response = await this.getResponse(responseId);
        await this.assertCanReactivateResponse(response, currentUser);
        await this.assertLatestResponseInstance(response);
        await this.createReview(
            response.id,
            currentUser.id,
            InformedConsentReviewAction.REACTIVATE,
            input.reason,
            input.comment,
        );
        await this.responseRepository.update(response.id, {
            status: InformedConsentResponseStatus.REACTIVATED,
        });
        await this.dispatchConsentNotification(NotificationEvent.INFORMED_CONSENT_REACTIVATED, response.id);
        return this.getResponse(response.id);
    }

    async reactivateOwn(
        input: ReviewInformedConsentResponseInput,
        currentUser: User,
    ): Promise<InformedConsentResponse> {
        const responseId = Number(input.responseId);
        if (!responseId) {
            throw new BadRequestException('responseId is required to reactivate an informed consent response.');
        }
        const response = await this.getResponse(responseId);
        const allowedUserIds = [response.signerUserId, response.representedUserId].filter(Boolean);
        if (!allowedUserIds.some(userId => Number(userId) === Number(currentUser.id))) {
            throw new ForbiddenException('You cannot reactivate another user informed consent response.');
        }
        if (response.status === InformedConsentResponseStatus.BLOCKED) {
            throw new ForbiddenException('Blocked informed consent responses must be reactivated by an authorized responsible user.');
        }
        return this.reactivate(input, currentUser);
    }

    async revoke(
        input: ReviewInformedConsentResponseInput,
        currentUser: User,
    ): Promise<InformedConsentResponse> {
        const responseId = Number(input.responseId);
        if (!responseId) {
            throw new BadRequestException('responseId is required to revoke an informed consent response.');
        }
        const response = await this.getResponse(responseId);
        await this.createReview(
            response.id,
            currentUser.id,
            InformedConsentReviewAction.REVOKE,
            input.reason,
            input.comment,
        );
        await this.responseRepository.update(response.id, {
            status: InformedConsentResponseStatus.REVOKED,
        });
        return this.getResponse(response.id);
    }

    async cancelReactivationOwn(
        input: CancelInformedConsentReactivationInput,
        currentUser: User,
    ): Promise<InformedConsentResponse> {
        const responseId = Number(input.responseId);
        if (!responseId) {
            throw new BadRequestException('responseId is required to cancel an informed consent reactivation.');
        }
        const response = await this.getResponse(responseId);
        const allowedUserIds = [response.signerUserId, response.representedUserId].filter(Boolean);
        if (!allowedUserIds.some(userId => Number(userId) === Number(currentUser.id))) {
            throw new ForbiddenException('You cannot cancel another user informed consent reactivation.');
        }
        if (response.status !== InformedConsentResponseStatus.REACTIVATED) {
            return response;
        }
        await this.createReview(
            response.id,
            currentUser.id,
            InformedConsentReviewAction.CANCEL_REACTIVATION,
            'El usuario salió de la edición sin registrar una nueva respuesta.',
        );
        await this.responseRepository.update(response.id, {
            status: input.previousStatus || InformedConsentResponseStatus.SUBMITTED,
        });
        return this.getResponse(response.id);
    }

    async cancelReactivationPublic(
        token: string,
        input: CancelInformedConsentReactivationInput,
    ): Promise<InformedConsentResponse> {
        const payload = this.publicTokenPayload(token);
        const response = await this.getResponse(Number(input.responseId));
        const allowedUserIds = [response.signerUserId, response.representedUserId].filter(Boolean);
        if (!allowedUserIds.some(userId => Number(userId) === Number(payload.userId))) {
            throw new ForbiddenException('You cannot cancel another user informed consent reactivation.');
        }
        if (response.status !== InformedConsentResponseStatus.REACTIVATED) {
            return response;
        }
        await this.createReview(
            response.id,
            payload.userId,
            InformedConsentReviewAction.CANCEL_REACTIVATION,
            'El usuario salió de la edición pública sin registrar una nueva respuesta.',
        );
        await this.responseRepository.update(response.id, {
            status: input.previousStatus || InformedConsentResponseStatus.SUBMITTED,
        });
        return this.getResponse(response.id);
    }

    private async loadUserScope(userId: number): Promise<User | undefined> {
        return this.userRepository.findOne(userId, {
            relations: ['roles', 'departments'],
        });
    }

    private async resolvePatientIdForSigner(userId: number): Promise<number | undefined> {
        const patient = await this.patientRepository.findOne({
            where: { userId },
            select: ['id'],
        });
        return patient?.id;
    }

    private async createReview(
        responseId: number,
        reviewerUserId: number,
        action: InformedConsentReviewAction,
        reason: string,
        comment?: string,
    ): Promise<void> {
        responseId = Number(responseId);
        reviewerUserId = Number(reviewerUserId);
        if (!responseId) {
            throw new BadRequestException('responseId is required to create an informed consent review.');
        }
        await this.reviewRepository.manager.query(
            `
            INSERT INTO informed_consent_review
                ("responseId", "reviewerUserId", "action", "reason", "comment", "createdAt")
            VALUES ($1, $2, $3, $4, $5, now())
            `,
            [responseId, reviewerUserId, action, reason, comment],
        );
    }

    private async assertCanReactivateResponse(
        response: InformedConsentResponse,
        currentUser: User,
    ): Promise<void> {
        if (Number(response.signerUserId) === Number(currentUser.id)) {
            if (response.status === InformedConsentResponseStatus.BLOCKED) {
                throw new ForbiddenException('Blocked informed consent responses must be reactivated by an authorized responsible user.');
            }
            return;
        }

        const user = await this.userRepository.findOne(currentUser.id, {
            relations: ['roles', 'roles.permissions', 'permissions'],
        });
        if (user?.isSuperUser) return;
        if (this.hasAnyPermission(user, [
            PermissionEnum.REVIEW_INFORMED_CONSENT_RESPONSES,
            PermissionEnum.MANAGE_PATIENTS,
            PermissionEnum.MANAGE_USERS,
        ])) return;

        if (response.patientId) {
            const patient = await this.patientRepository.findOne(response.patientId, {
                relations: ['caseManagers'],
            });
            if ((patient?.caseManagers || []).some(manager => Number(manager.id) === Number(currentUser.id))) return;
        } else {
            const signer = await this.userRepository.findOne(response.signerUserId, {
                relations: ['supervisors'],
            });
            if ((signer?.supervisors || []).some(supervisor => Number(supervisor.id) === Number(currentUser.id))) return;
        }

        throw new ForbiddenException('You are not allowed to reactivate this informed consent response.');
    }

    private async assertLatestResponseInstance(response: InformedConsentResponse): Promise<void> {
        const query = this.responseRepository
            .createQueryBuilder('response')
            .where('response."signerUserId" = :signerUserId', { signerUserId: response.signerUserId })
            .orderBy('response."createdAt"', 'DESC');

        if (response.managementId) {
            query.andWhere('response."managementId" = :managementId', { managementId: response.managementId });
        } else {
            query.andWhere('response."managementId" IS NULL');
        }

        if (response.representedUserId) {
            query.andWhere('response."representedUserId" = :representedUserId', { representedUserId: response.representedUserId });
        } else {
            query.andWhere('response."representedUserId" IS NULL');
        }

        const latest = await query.getOne();
        if (latest && Number(latest.id) !== Number(response.id)) {
            throw new BadRequestException('Only the latest informed consent response instance can be reactivated.');
        }
    }

    private hasAnyPermission(user: User | undefined, permissions: string[]): boolean {
        const direct = user?.permissions || [];
        const rolePermissions = (user?.roles || []).flatMap(role => role.permissions || []);
        const names = new Set([...direct, ...rolePermissions].map(permission => permission.name));
        return permissions.some(permission => names.has(permission));
    }

    private async applicableManagements(user: User): Promise<InformedConsentManagement[]> {
        const active = await this.managementRepository.find({
            where: {
                active: true,
                status: InformedConsentManagementStatus.ACTIVE,
            },
            relations: ['model', 'departments', 'roles'],
            order: { priority: 'ASC', id: 'ASC' },
        });
        const withPublishedModel = active.filter(management => (
            management.model?.active && management.model.currentPublishedVersionId
        ));
        const result: InformedConsentManagement[] = [];
        for (const management of withPublishedModel) {
            if (await this.managementAppliesToUser(management, user)) result.push(management);
        }
        return result;
    }

    private async managementAppliesToUser(
        management: InformedConsentManagement,
        user: User,
    ): Promise<boolean> {
        const roleIds = new Set((user.roles ?? []).map(role => role.id));
        const departmentIds = new Set((user.departments ?? []).map(department => department.id));
        const roleApplies = management.appliesToAllRoles
            || (management.roles ?? []).some(role => roleIds.has(role.id));
        const departmentApplies = management.appliesToAllDepartments
            || (management.departments ?? []).some(department => departmentIds.has(department.id));
        return roleApplies && departmentApplies && this.profileConditionsApply(management, user);
    }

    private profileConditionsApply(management: InformedConsentManagement, user: User): boolean {
        if (!management.profileConditions) return true;
        if (management.profileConditions.excludePatientRole) {
            return !(user.roles ?? []).some(role => role.code === RoleCode.PATIENT);
        }
        return true;
    }

    private async latestResponse(
        userId: number,
        managementId: number,
    ): Promise<InformedConsentResponse | undefined> {
        return this.responseRepository.findOne({
            where: { signerUserId: userId, managementId },
            order: { createdAt: 'DESC' },
        });
    }

    private isSatisfied(
        management: InformedConsentManagement,
        response?: InformedConsentResponse,
    ): boolean {
        if (!response) return false;
        if (response.status === InformedConsentResponseStatus.REACTIVATED) return false;
        if (response.status === InformedConsentResponseStatus.REVOKED) return false;
        if (response.status === InformedConsentResponseStatus.BLOCKED) return false;
        return response.status === InformedConsentResponseStatus.SUBMITTED;
    }

    private resolveFinalResolution(
        resolutions: InformedConsentAnswerResolution[],
    ): InformedConsentAnswerResolution {
        if (resolutions.includes(InformedConsentAnswerResolution.REJECTS)) {
            return InformedConsentAnswerResolution.REJECTS;
        }
        if (resolutions.includes(InformedConsentAnswerResolution.REQUIRES_REVIEW)) {
            return InformedConsentAnswerResolution.REQUIRES_REVIEW;
        }
        if (resolutions.includes(InformedConsentAnswerResolution.ACCEPTS)) {
            return InformedConsentAnswerResolution.ACCEPTS;
        }
        return InformedConsentAnswerResolution.NOT_APPLICABLE;
    }

    private modelSnapshot(management: InformedConsentManagement): any {
        const version = management.model.currentPublishedVersion;
        return {
            managementId: management.id,
            modelId: management.modelId,
            versionId: management.model.currentPublishedVersionId,
            modelName: management.model.name,
            kind: management.model.kind,
            title: version?.title,
            textBlocks: version?.textBlocks ?? [],
            questions: version?.questions ?? [],
        };
    }

    private async dispatchConsentNotification(
        event: NotificationEvent,
        responseId: number,
    ): Promise<void> {
        const response = await this.responseRepository.findOne(responseId, {
            relations: ['model', 'version', 'signer', 'signer.supervisors', 'patient'],
        });
        if (!response?.signer) return;
        const recipients = await this.resolveConsentResponsibleRecipients(response);
        for (const recipient of recipients) {
            await this.notificationDispatchService.dispatchUserEvent({
                event,
                recipient,
                patientId: response.patientId,
                therapistId: response.patientId ? undefined : response.signerUserId,
                data: {
                    consent: {
                        modelName: response.model?.name,
                        version: response.version?.versionNumber,
                        resolution: response.finalResolution,
                        status: response.status,
                        signer: {
                            id: response.signer.id,
                            firstName: response.signer.firstName,
                            lastName: response.signer.lastName,
                            fullName: [response.signer.firstName, response.signer.lastName].filter(Boolean).join(' '),
                            email: response.signer.email,
                            username: response.signer.username,
                        },
                        pendingLink: url('psira/informed-consent/pending'),
                        link: this.publicResponseLinkForUser(response.signerUserId),
                    },
                },
            });
        }
    }

    private async resolveConsentResponsibleRecipients(response: InformedConsentResponse): Promise<User[]> {
        const recipients = response.patientId
            ? (await this.patientRepository.findOne(response.patientId, { relations: ['caseManagers'] }))?.caseManagers || []
            : (response.signer?.supervisors || []);
        const seen = new Set<number>();
        return recipients.filter(recipient => {
            if (!recipient?.id || seen.has(recipient.id)) return false;
            seen.add(recipient.id);
            return true;
        });
    }
}
