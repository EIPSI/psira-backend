import { ClinicalAccess, departmentIds, intersection } from 'src/shared/clinical-access';
import { clinicalResponders } from 'src/shared/clinical-responders';
import { userTimezone } from 'src/shared/user-timezone';
import * as moment from 'moment-timezone';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateFullAssessmentInput } from 'src/modules/assessment/dtos/create-assessment.input';
import { Assessment } from 'src/modules/assessment/models/assessment.model';
import { AssessmentService } from 'src/modules/assessment/services/assessment.service';
import { CalendarOccurrenceStatus } from 'src/modules/calendar/enums/calendar-occurrence-status.enum';
import { CalendarOccurrenceType } from 'src/modules/calendar/enums/calendar-occurrence-type.enum';
import { CalendarOccurrence } from 'src/modules/calendar/models/calendar-occurrence.model';
import { CreateClinicalSessionInput } from 'src/modules/clinical-session/dtos/clinical-session.input';
import { ClinicalSessionResource } from 'src/modules/clinical-session/models/clinical-session-resource.model';
import { ClinicalSession } from 'src/modules/clinical-session/models/clinical-session.model';
import { ClinicalSessionSchedulingService } from 'src/modules/clinical-session/services/clinical-session-scheduling.service';
import { Patient } from 'src/modules/patient/models/patient.model';
import { AssessmentStatus } from 'src/modules/questionnaire/enums/assessment-status.enum';
import { RandomizationResolutionService } from 'src/modules/randomization/services/randomization-resolution.service';
import { User } from 'src/modules/user/models/user.model';
import { Repository } from 'typeorm';
import {
    ApplyEvaluationSchemeInput,
    GenerateSchemeOccurrencesInput,
    RegenerateFutureSchemeOccurrencesInput,
} from '../dtos/evaluation-scheme-generation.input';
import { EvaluationSchemeAssignmentStatus } from '../enums/evaluation-scheme-assignment-status.enum';
import { EvaluationSchemeType } from '../enums/evaluation-scheme-type.enum';
import { IndependentEvaluationTemplate } from '../models/independent-evaluation-template.model';
import { EvaluationSchemeAssignment } from '../models/evaluation-scheme-assignment.model';
import { EvaluationScheme } from '../models/evaluation-scheme.model';
import { SchemeResourceTemplate } from '../models/scheme-resource-template.model';
import { SchemeSessionTemplate } from '../models/scheme-session-template.model';

interface GenerationContext {
    assignment: EvaluationSchemeAssignment;
    scheme: EvaluationScheme;
    currentUser?: User;
    responderUserId: number;
    responderEmail?: string;
    clinicianId: number;
    responsibleUserIds: number[];
    maxOccurrences: number;
    generationEndsAt: Date;
    generationStartsAt: Date;
}

interface GenerateOccurrencesOptions {
    ignoreExisting?: boolean;
    from?: Date;
}

interface FixedTemplateWindow {
    windowStartAt: Date;
    windowEndAt: Date;
    deliveryAt: Date;
    expirationAt: Date;
}

@Injectable()
export class SchemeGenerationService {
    constructor(
        @InjectRepository(EvaluationScheme)
        private readonly schemeRepository: Repository<EvaluationScheme>,
        @InjectRepository(EvaluationSchemeAssignment)
        private readonly assignmentRepository: Repository<EvaluationSchemeAssignment>,
        @InjectRepository(SchemeSessionTemplate)
        private readonly sessionTemplateRepository: Repository<SchemeSessionTemplate>,
        @InjectRepository(SchemeResourceTemplate)
        private readonly resourceTemplateRepository: Repository<SchemeResourceTemplate>,
        @InjectRepository(IndependentEvaluationTemplate)
        private readonly independentTemplateRepository: Repository<IndependentEvaluationTemplate>,
        @InjectRepository(CalendarOccurrence)
        private readonly occurrenceRepository: Repository<CalendarOccurrence>,
        @InjectRepository(Assessment)
        private readonly assessmentRepository: Repository<Assessment>,
        @InjectRepository(ClinicalSession)
        private readonly clinicalSessionRepository: Repository<ClinicalSession>,
        @InjectRepository(ClinicalSessionResource)
        private readonly resourceRepository: Repository<ClinicalSessionResource>,
        @InjectRepository(Patient)
        private readonly patientRepository: Repository<Patient>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly clinicalSessionSchedulingService: ClinicalSessionSchedulingService,
        private readonly assessmentService: AssessmentService,
        private readonly randomizationResolutionService: RandomizationResolutionService,
    ) {}

    async applyScheme(
        input: ApplyEvaluationSchemeInput,
        currentUser?: User,
        source?: { automationId?: number; departmentIds?: number[] },
    ): Promise<EvaluationSchemeAssignment> {
        if (currentUser) await ClinicalAccess.assertTarget(currentUser, input.patientId, input.targetUserId || input.therapistId);
        if (!!input.schemeId === !!input.randomizationRuleId) {
            throw new BadRequestException(
                'Apply scheme requires either schemeId or randomizationRuleId',
            );
        }

        const scheme = input.randomizationRuleId
            ? await this.randomizationResolutionService.resolveHighLevelScheme(
                  input.randomizationRuleId,
              )
            : await this.schemeRepository.findOne(input.schemeId, { relations: ['departments'] });
        if (!scheme) throw new NotFoundException('Evaluation scheme not found');
        if (currentUser && scheme.departments?.length && !currentUser.isSuperUser) {
            const patient = input.patientId ? await this.patientRepository.findOne(input.patientId, { relations: ['departments'] }) : null;
            const target = patient || await this.userRepository.findOne(input.targetUserId || input.therapistId, { relations: ['departments'] });
            if (!intersection(departmentIds(target), departmentIds(scheme)).length) throw new BadRequestException('Scheme is unavailable in this case departments');
        }

        // Fixed moments belong to the respondent, even when applied by a clinician.
        const responder = scheme.schemeType === EvaluationSchemeType.INDEPENDENT_EVALUATION
            ? await this.resolveResponderUser(input as EvaluationSchemeAssignment)
            : undefined;
        const timezone = responder ? userTimezone(responder) : input.timezone || userTimezone(currentUser);

        const assignment = await this.assignmentRepository.save(
            this.assignmentRepository.create({
                schemeId: scheme.id,
                automationId: source?.automationId,
                departmentIds: source?.departmentIds,
                randomizationRuleId: input.randomizationRuleId,
                patientId: input.patientId,
                targetUserId: input.targetUserId,
                therapistId: input.therapistId,
                supervisorId: input.supervisorId,
                responderUserId: input.responderUserId,
                clinicianId: input.clinicianId,
                startDate: input.startDate,
                timezone,
                status: EvaluationSchemeAssignmentStatus.ACTIVE,
                maxFutureOccurrences: input.maxFutureOccurrences || 12,
                futureGenerationMonths: input.futureGenerationMonths || 3,
            }),
        );

        await this.generateOccurrences({ assignmentId: assignment.id }, currentUser);

        return this.assignmentRepository.findOneOrFail(assignment.id, {
            relations: ['scheme', 'occurrences'],
        });
    }

    async generateOccurrences(
        input: GenerateSchemeOccurrencesInput,
        currentUser?: User,
        options: GenerateOccurrencesOptions = {},
    ): Promise<CalendarOccurrence[]> {
        const assignment = await this.assignmentRepository.findOne(
            input.assignmentId,
            { relations: ['scheme', 'patient'] },
        );
        if (!assignment) throw new NotFoundException('Scheme assignment not found');
        if (currentUser) await ClinicalAccess.assertTarget(currentUser, assignment.patientId, assignment.targetUserId || assignment.therapistId);
        if (assignment.status !== EvaluationSchemeAssignmentStatus.ACTIVE) {
            throw new BadRequestException('Only active assignments can generate occurrences');
        }

        if (!options.ignoreExisting) {
            const existingOccurrences = await this.occurrenceRepository.find({
                where: { schemeAssignmentId: input.assignmentId },
                order: { startAt: 'ASC' },
            });
            if (existingOccurrences.length) return existingOccurrences;
        }

        const scheme = assignment.scheme;
        const responderUser = await this.resolveResponderUser(assignment);
        const clinicianId = this.resolveClinicianId(assignment, currentUser);
        const responsibleUserIds = this.resolveResponsibleUserIds(assignment, clinicianId);
        const context: GenerationContext = {
            assignment,
            scheme,
            currentUser,
            responderUserId: responderUser.id,
            responderEmail: responderUser.email,
            clinicianId,
            responsibleUserIds,
            maxOccurrences: assignment.maxFutureOccurrences || 12,
            generationStartsAt: options.from
                ? new Date(options.from)
                : new Date(assignment.startDate),
            generationEndsAt: this.addMonths(
                options.from ? new Date(options.from) : assignment.startDate,
                assignment.futureGenerationMonths || 3,
            ),
        };

        if (scheme.schemeType === EvaluationSchemeType.SESSION_BASED) {
            return this.generateSessionOccurrences(context);
        }

        return this.generateIndependentEvaluationOccurrences(context);
    }

    async regenerateFutureOccurrences(
        input: RegenerateFutureSchemeOccurrencesInput,
        currentUser?: User,
    ): Promise<CalendarOccurrence[]> {
        const from = input.from ? new Date(input.from) : new Date();
        const assignment = await this.assignmentRepository.findOneOrFail(input.assignmentId);
        if (currentUser) await ClinicalAccess.assertTarget(currentUser, assignment.patientId, assignment.targetUserId || assignment.therapistId);
        await this.removeRegenerableFutureOccurrences(input.assignmentId, from, currentUser);

        return this.generateOccurrences(
            { assignmentId: input.assignmentId },
            currentUser,
            { ignoreExisting: true, from },
        );
    }

    private async generateSessionOccurrences(
        context: GenerationContext,
    ): Promise<CalendarOccurrence[]> {
        const sessionTemplates = await this.sessionTemplateRepository.find({
            where: { schemeId: context.scheme.id },
            order: { sessionIndex: 'ASC' },
        });

        if (!sessionTemplates.length) {
            throw new BadRequestException('Session-based scheme has no session templates');
        }

        const generated: CalendarOccurrence[] = [];
        const recurrenceDates = this.buildRecurrenceDates(context);

        for (const baseDate of recurrenceDates) {
            for (const sessionTemplate of sessionTemplates) {
                if (generated.length >= context.maxOccurrences) return generated;

                const startAt = this.addDays(
                    baseDate,
                    sessionTemplate.relativeOffsetDays || 0,
                );
                if (startAt > context.generationEndsAt) return generated;

                const endAt = this.addMinutes(
                    startAt,
                    sessionTemplate.durationMinutes ||
                        context.scheme.defaultDurationMinutes ||
                        60,
                );

                const resourceTemplates = await this.resourceTemplateRepository.find({
                    where: { sessionTemplateId: sessionTemplate.id },
                });

                const session = await this.clinicalSessionSchedulingService.createClinicalSession(
                    await this.buildClinicalSessionInput(
                        context,
                        sessionTemplate,
                        resourceTemplates,
                        startAt,
                        endAt,
                    ),
                    context.currentUser,
                );

                generated.push(session.calendarOccurrence);
            }
        }

        return generated;
    }

    private async generateIndependentEvaluationOccurrences(
        context: GenerationContext,
    ): Promise<CalendarOccurrence[]> {
        const templates = await this.independentTemplateRepository.find({
            where: { schemeId: context.scheme.id },
            order: {
                relativeDay: 'ASC',
                relativeMinuteOfDay: 'ASC',
                seedOrder: 'ASC',
                id: 'ASC',
            },
        });

        if (!templates.length) {
            throw new BadRequestException('Independent evaluation scheme has no evaluation templates');
        }

        const generated: CalendarOccurrence[] = [];
        const recurrenceDates = this.buildRecurrenceDates(context);

        for (const baseDate of recurrenceDates) {
            for (const template of templates) {
                const shouldLimitOccurrences = !!context.scheme.defaultRecurrenceRule;
                if (shouldLimitOccurrences && generated.length >= context.maxOccurrences) {
                    return generated;
                }
                const responders = await clinicalResponders(template.defaultResponderRole, {
                    ...context.assignment, responsibleUserIds: context.responsibleUserIds,
                    sessionKind: context.assignment.supervisorId ? 'SUPERVISION' : 'CLINICAL',
                }, context.responderUserId);
                for (const responder of responders) {
                    const timezone = userTimezone(responder);
                    const localDate = moment.tz(baseDate, context.assignment.timezone).format('YYYY-MM-DD');
                    const respondentContext = { ...context, responderUserId: responder.id, responderEmail: responder.email,
                        assignment: { ...context.assignment, timezone } as EvaluationSchemeAssignment };
                    const window = this.buildFixedTemplateWindow(respondentContext, moment.tz(localDate, 'YYYY-MM-DD', timezone).toDate(), template);
                    if (window.deliveryAt > context.generationEndsAt) continue;
                    generated.push(await this.createIndependentEvaluationOccurrence(respondentContext, template, window));
                }
            }
        }

        return generated;
    }

    private async buildClinicalSessionInput(
        context: GenerationContext,
        sessionTemplate: SchemeSessionTemplate,
        resourceTemplates: SchemeResourceTemplate[],
        startAt: Date,
        endAt: Date,
    ): Promise<CreateClinicalSessionInput> {
        const input: CreateClinicalSessionInput = {
            title: sessionTemplate.title,
            sessionKind: sessionTemplate.sessionKind,
            startAt,
            endAt,
            timezone: context.assignment.timezone,
            schemeId: context.scheme.id,
            schemeAssignmentId: context.assignment.id,
            sessionTemplateId: sessionTemplate.id,
            sessionNumber: sessionTemplate.sessionIndex,
            patientId: context.assignment.patientId,
            targetUserId: context.assignment.targetUserId,
            therapistId: context.assignment.therapistId,
            supervisorId: context.assignment.supervisorId,
            responsibleUserIds: context.responsibleUserIds,
            resources: resourceTemplates.map(resourceTemplate => ({
                resourceTemplateId: resourceTemplate.id,
                resourceKind: resourceTemplate.resourceKind,
                assessmentTypeId: resourceTemplate.assessmentTypeId,
                name: resourceTemplate.name,
                questionnaires: resourceTemplate.questionnaireIds || [],
                questionnaireBundles: resourceTemplate.questionnaireBundleIds || [],
                randomizationRuleIds: resourceTemplate.randomizationRuleIds || [],
                responderUserId: context.responderUserId,
                clinicianId: context.clinicianId,
                informantType: resourceTemplate.informantType,
                emailReminder: this.shouldSendSchemeEmails(context),
                mailTemplateId: this.schemeMailTemplateId(context),
                receiverEmail: context.responderEmail,
                activationAnchor: resourceTemplate.activationAnchor,
                activationOffsetMinutes: resourceTemplate.activationOffsetMinutes,
                availabilityDurationMinutes:
                    resourceTemplate.availabilityDurationMinutes,
                reminderMinutes: resourceTemplate.reminderMinutes || [],
            })),
        };
        const resources = [];
        for (const [index, template] of resourceTemplates.entries()) {
            const responders = await clinicalResponders(template.defaultResponderRole, input, context.responderUserId);
            for (const responder of responders) resources.push({ ...input.resources[index], responderUserId: responder.id, receiverEmail: responder.email,
                informantType: template.defaultResponderRole ? (responder.id === context.responderUserId ? template.informantType : 'OTHER_USER') : template.informantType });
        }
        input.resources = resources;
        return input;
    }

    private async createIndependentEvaluationOccurrence(
        context: GenerationContext,
        template: IndependentEvaluationTemplate,
        window: FixedTemplateWindow,
    ): Promise<CalendarOccurrence> {
        const occurrence = await this.occurrenceRepository.save(
            this.occurrenceRepository.create({
                occurrenceType: CalendarOccurrenceType.INDEPENDENT_ASSESSMENT,
                title: template.name || context.scheme.name,
                startAt: window.deliveryAt,
                endAt: window.expirationAt,
                timezone: context.assignment.timezone,
                status: CalendarOccurrenceStatus.SCHEDULED,
                schemeId: context.scheme.id,
                schemeAssignmentId: context.assignment.id,
                patientId: context.assignment.patientId,
                therapistId: context.assignment.therapistId,
                supervisorId: context.assignment.supervisorId,
            }),
        );
        occurrence.responsibleUsers = await this.responsibleUsers(context.responsibleUserIds);
        await this.occurrenceRepository.save(occurrence);

        const assessment = await this.assessmentService.createNewAssessment(
            ({
                assessmentTypeId: template.assessmentTypeId,
                name: template.name,
                patientId: context.assignment.patientId,
                targetUserId: context.assignment.targetUserId,
                responderUserId: context.responderUserId,
                clinicianId: context.clinicianId,
                responsibleUserIds: context.responsibleUserIds,
                informantType: template.informantType,
                questionnaires: template.questionnaireIds || [],
                questionnaireBundles: template.questionnaireBundleIds || [],
                randomizationRuleIds: template.randomizationRuleIds || [],
                dates: [
                    {
                        deliveryDate: window.deliveryAt,
                        expirationDate: window.expirationAt,
                        reminderMinutes: template.reminderMinutes || [],
                        reminderUnit: template.reminderUnit || 'MINUTES',
                    },
                ],
                reminderUnit: template.reminderUnit || 'MINUTES',
                emailReminder: this.shouldSendSchemeEmails(context),
                mailTemplateId: this.schemeMailTemplateId(context),
                receiverEmail: context.responderEmail,
            } as unknown) as CreateFullAssessmentInput,
            context.currentUser,
            { automationId: context.assignment.automationId, departmentIds: context.assignment.departmentIds },
        );

        assessment.calendarOccurrenceId = occurrence.id;
        assessment.schemeId = context.scheme.id;
        assessment.schemeAssignmentId = context.assignment.id;
        await this.assessmentRepository.save(assessment);

        return occurrence;
    }

    private buildFixedTemplateWindow(
        context: GenerationContext,
        baseDate: Date,
        template: IndependentEvaluationTemplate,
    ): FixedTemplateWindow {
        const timezone = context.assignment.timezone || 'UTC';
        if (!moment.tz.zone(timezone)) throw new BadRequestException('Invalid scheme timezone');
        // Interpret each fixed moment in the respondent's zone, then persist its UTC instant.
        const relativeDayStart = moment.tz(baseDate, timezone).startOf('day');

        const dayOffset = template.relativeDay || 0;
        const startMinute =
            template.startMinuteOfDay === undefined ||
            template.startMinuteOfDay === null
                ? template.relativeMinuteOfDay || 0
                : template.startMinuteOfDay;
        const durationMinutes =
            template.durationMinutes ||
            context.scheme.defaultDurationMinutes ||
            60;
        const endMinute = this.resolveFixedTemplateEndMinute(
            template,
            startMinute,
            durationMinutes,
        );

        const atMinute = (minute: number): Date => relativeDayStart.clone()
            .add(dayOffset + Math.floor(minute / 1440), 'days')
            .hour(Math.floor((minute % 1440) / 60))
            .minute(minute % 60)
            .second(0)
            .millisecond(0)
            .toDate();
        const windowStartAt = atMinute(startMinute);
        const windowEndAt = atMinute(endMinute);
        const deliveryAt = this.resolveFixedTemplateDeliveryAt(
            context,
            template,
            windowStartAt,
            windowEndAt,
        );
        const expirationAt = this.addMinutes(
            deliveryAt,
            template.availabilityDurationMinutes ||
                durationMinutes ||
                60,
        );

        return {
            windowStartAt,
            windowEndAt,
            deliveryAt,
            expirationAt,
        };
    }

    private resolveFixedTemplateEndMinute(
        template: IndependentEvaluationTemplate,
        startMinute: number,
        durationMinutes: number,
    ): number {
        const endMinute =
            template.endMinuteOfDay === undefined || template.endMinuteOfDay === null
                ? startMinute + durationMinutes
                : template.endMinuteOfDay;

        if (endMinute <= startMinute) {
            return startMinute + Math.max(15, durationMinutes || 60);
        }

        return endMinute;
    }

    private resolveFixedTemplateDeliveryAt(
        context: GenerationContext,
        template: IndependentEvaluationTemplate,
        windowStartAt: Date,
        windowEndAt: Date,
    ): Date {
        if (template.triggerMode !== 'RANDOM_WITHIN_WINDOW') {
            return windowStartAt;
        }

        const windowMinutes = Math.max(
            0,
            Math.floor(
                (windowEndAt.getTime() - windowStartAt.getTime()) / 60000,
            ),
        );
        if (!windowMinutes) return windowStartAt;

        const offset = this.deterministicMinuteOffset(
            [
                context.assignment.id,
                template.id,
                template.relativeDay || 0,
                template.startMinuteOfDay || template.relativeMinuteOfDay || 0,
                template.seedOrder || 0,
                windowStartAt.toISOString(),
            ].join(':'),
            windowMinutes,
        );

        return this.addMinutes(windowStartAt, offset);
    }

    private deterministicMinuteOffset(seed: string, maxMinutes: number): number {
        let hash = 0;
        for (let index = 0; index < seed.length; index++) {
            hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
        }
        return hash % (maxMinutes + 1);
    }

    private buildRecurrenceDates(context: GenerationContext): Date[] {
        const dates: Date[] = [];
        const interval = this.parseRecurrence(context.scheme.defaultRecurrenceRule);
        let current = new Date(context.assignment.startDate);

        while (current < context.generationStartsAt) {
            if (!interval) return [];
            current = this.nextRecurrenceDate(current, interval, context);
        }

        while (
            dates.length < context.maxOccurrences &&
            current <= context.generationEndsAt
        ) {
            dates.push(new Date(current));
            if (!interval) break;
            current = this.nextRecurrenceDate(current, interval, context);
        }

        return dates;
    }

    private async removeRegenerableFutureOccurrences(
        assignmentId: number,
        from: Date,
        currentUser?: User,
    ): Promise<void> {
        const occurrences = await this.occurrenceRepository.find({
            where: {
                schemeAssignmentId: assignmentId,
                isDetachedFromTemplate: false,
            },
            relations: ['assessments', 'clinicalSession', 'clinicalSession.resources'],
            order: { startAt: 'ASC' },
        });

        // Authorize the complete batch before changing or deleting anything.
        if (currentUser) {
            const viewer = await ClinicalAccess.viewer(currentUser.id);
            const grants = await ClinicalAccess.grants(currentUser.id);
            for (const occurrence of occurrences.filter(item => item.startAt >= from)) {
                if (occurrence.clinicalSession && !ClinicalAccess.canSession(
                    await ClinicalAccess.session(occurrence.clinicalSession.id), viewer, grants, 'edit',
                )) throw new BadRequestException('Cannot regenerate another responsible user’s session');
                for (const assessment of occurrence.assessments || []) {
                    await ClinicalAccess.assertAssessment(assessment, currentUser, 'edit');
                }
            }
        }
        for (const occurrence of occurrences) {
            if (occurrence.startAt < from) continue;

            const assessments = await this.assessmentRepository.find({
                where: { calendarOccurrenceId: occurrence.id },
            });

            if (assessments.some(assessment => this.isAssessmentAnswered(assessment))) {
                occurrence.isDetachedFromTemplate = true;
                occurrence.notes = [
                    occurrence.notes,
                    'Detached from scheme regeneration because it contains answered assessments.',
                ]
                    .filter(Boolean)
                    .join('\n');
                await this.occurrenceRepository.save(occurrence);
                continue;
            }

            await this.deleteOccurrenceTree(occurrence, assessments);
        }
    }

    private async deleteOccurrenceTree(
        occurrence: CalendarOccurrence,
        assessments: Assessment[],
    ): Promise<void> {
        const clinicalSession = occurrence.clinicalSession
            ? occurrence.clinicalSession
            : await this.clinicalSessionRepository.findOne({
                  where: { calendarOccurrenceId: occurrence.id },
                  relations: ['resources'],
              });

        if (clinicalSession) {
            await this.assessmentRepository.update(
                { clinicalSessionId: clinicalSession.id },
                {
                    clinicalSessionId: null,
                    clinicalSessionResourceId: null,
                },
            );
            await this.resourceRepository.delete({
                clinicalSessionId: clinicalSession.id,
            });
            await this.clinicalSessionRepository.delete(clinicalSession.id);
        }

        await this.assessmentRepository.update(
            { calendarOccurrenceId: occurrence.id },
            { calendarOccurrenceId: null },
        );

        for (const assessment of assessments) {
            await this.assessmentService.deleteAssessment(assessment.id, false);
        }

        await this.occurrenceRepository.delete(occurrence.id);
    }

    private isAssessmentAnswered(assessment: Assessment): boolean {
        return (
            !!assessment.submissionDate ||
            [
                AssessmentStatus.COMPLETED,
                AssessmentStatus.PARTIALLY_COMPLETED,
            ].includes(assessment.status as AssessmentStatus)
        );
    }

    private parseRecurrence(rule?: string): 'DAILY' | 'WEEKLY' | 'MONTHLY' | null {
        if (!rule) return null;

        const normalized = rule.toUpperCase();
        if (normalized === 'DAILY' || normalized.includes('FREQ=DAILY')) {
            return 'DAILY';
        }
        if (normalized === 'WEEKLY' || normalized.includes('FREQ=WEEKLY')) {
            return 'WEEKLY';
        }
        if (normalized === 'MONTHLY' || normalized.includes('FREQ=MONTHLY')) {
            return 'MONTHLY';
        }

        throw new BadRequestException(`Unsupported recurrence rule: ${rule}`);
    }

    private nextRecurrenceDate(
        date: Date,
        interval: 'DAILY' | 'WEEKLY' | 'MONTHLY',
        context: GenerationContext,
    ): Date {
        if (context.scheme.schemeType !== EvaluationSchemeType.INDEPENDENT_EVALUATION) {
            return this.addInterval(date, interval);
        }
        // Fixed day moments follow respondent calendar dates before conversion to UTC.
        return moment.tz(date, context.assignment.timezone || 'UTC')
            .add(interval === 'WEEKLY' ? 7 : 1, interval === 'MONTHLY' ? 'months' : 'days')
            .toDate();
    }

    private addInterval(date: Date, interval: 'DAILY' | 'WEEKLY' | 'MONTHLY'): Date {
        if (interval === 'DAILY') return this.addDays(date, 1);
        if (interval === 'WEEKLY') return this.addDays(date, 7);
        return this.addMonths(date, 1);
    }

    private async resolveResponderUser(
        assignment: EvaluationSchemeAssignment,
    ): Promise<User> {
        const responderUserId = await this.resolveResponderUserId(assignment);
        const responderUser = await this.userRepository.findOne(responderUserId);
        if (!responderUser) {
            throw new BadRequestException('Unable to resolve responder user for scheme assignment');
        }
        return responderUser;
    }

    private async resolveResponderUserId(
        assignment: EvaluationSchemeAssignment,
    ): Promise<number> {
        if (assignment.responderUserId) return assignment.responderUserId;
        if (assignment.targetUserId) return assignment.targetUserId;

        if (assignment.patientId) {
            const patient = await this.patientRepository.findOne(assignment.patientId);
            if (patient?.userId) return patient.userId;
        }

        if (assignment.therapistId) return assignment.therapistId;

        throw new BadRequestException('Unable to resolve responder user for scheme assignment');
    }

    private shouldSendSchemeEmails(context: GenerationContext): boolean {
        return !!context.responderEmail;
    }

    private schemeMailTemplateId(context: GenerationContext): number | undefined {
        return undefined;
    }

    private resolveClinicianId(
        assignment: EvaluationSchemeAssignment,
        currentUser?: User,
    ): number {
        const clinicianId =
            assignment.clinicianId || assignment.therapistId || currentUser?.id;
        if (!clinicianId) {
            throw new BadRequestException('Unable to resolve clinician for scheme assignment');
        }
        return clinicianId;
    }

    private resolveResponsibleUserIds(
        assignment: EvaluationSchemeAssignment,
        clinicianId: number,
    ): number[] {
        return [...new Set(
            [assignment.therapistId, assignment.supervisorId, assignment.clinicianId, clinicianId]
                .map(id => Number(id))
                .filter(id => Number.isFinite(id) && id > 0),
        )];
    }

    private responsibleUsers(responsibleUserIds: number[]): Promise<User[]> {
        if (!responsibleUserIds.length) return Promise.resolve([]);
        return this.userRepository.findByIds(responsibleUserIds);
    }

    private addDays(date: Date, days: number): Date {
        return moment.utc(date).add(days, 'days').toDate();
    }

    private addMonths(date: Date, months: number): Date {
        return moment.utc(date).add(months, 'months').toDate();
    }

    private addMinutes(date: Date, minutes: number): Date {
        return new Date(date.getTime() + minutes * 60 * 1000);
    }
}
