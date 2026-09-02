import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRepository } from '@nestjs/typeorm';
import { Model } from 'mongoose';
import { Types } from 'mongoose';
import { getConnection, getManager, In, Repository } from 'typeorm';
import {
    CreateFullAssessmentInput,
    UpdateFullAssessmentInput,
} from '../dtos/create-assessment.input';
import { Assessment, FullPublicAssessment, FullAssessment } from '../models/assessment.model';
import { QuestionnaireAssessmentService } from '../../questionnaire/services/questionnaire-assessment.service';
import {
    Filter,
    InjectQueryService,
    mergeFilter,
    QueryService,
    SortDirection,
} from '@nestjs-query/core';
import {
    AssessmentConnection,
    AssessmentQuery,
} from '../dtos/assessment.query';
import { PatientAuthorizer } from 'src/modules/patient/authorizers/patient.authorizer';
import { User } from 'src/modules/user/models/user.model';
import { ConnectionType } from '@nestjs-query/query-graphql';
import { PatientQueryService } from 'src/modules/patient/providers/patient-query.service';
import { Patient } from 'src/modules/patient/models/patient.model';
import { PatientPermissionService, PatientAccessScope } from 'src/modules/patient/services/patient-permission.service';
import { Caregiver } from 'src/modules/caregiver/models/caregiver.model';
import { AssessmentStatus } from 'src/modules/questionnaire/enums/assessment-status.enum';
import { AssessmentType } from '../models/assessment-type.model';
import { AssessmentEmailStatus } from '../enums/assessment-emailstatus.enum';
import { AssessmentOrigin } from '../enums/assessment-origin.enum';
import { Validator } from 'src/shared';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { Questionnaire } from 'src/modules/questionnaire/models/questionnaire.schema';
import { QuestionnaireBundle } from 'src/modules/questionnaire/models/questionnaire-bundle.schema';
import { RandomizationRule } from 'src/modules/randomization/models/randomization-rule.model';
import { areDepartmentsCompatible } from 'src/shared/department-compatibility';
import { CalendarOccurrence } from 'src/modules/calendar/models/calendar-occurrence.model';
import { TreatmentCycleKind } from 'src/modules/treatment-cycle/enums/treatment-cycle-kind.enum';
import { TreatmentCycleStatus } from 'src/modules/treatment-cycle/enums/treatment-cycle-status.enum';
import { TreatmentCycle } from 'src/modules/treatment-cycle/models/treatment-cycle.model';
import { CaseHistoryEntryKind } from 'src/modules/treatment-cycle/enums/case-history-entry-kind.enum';
import { CaseHistoryEntry } from 'src/modules/treatment-cycle/models/case-history-entry.model';
import { NotificationConfigurationService } from 'src/modules/notification/services/notification-configuration.service';
import { NotificationDispatchService } from 'src/modules/notification/services/notification-dispatch.service';
import { NotificationChannel } from 'src/modules/notification/enums/notification-channel.enum';
import { NotificationEvent } from 'src/modules/notification/enums/notification-event.enum';
import { NotificationLogStatus } from 'src/modules/notification/enums/notification-log-status.enum';

@Injectable()
export class AssessmentService {
    constructor(
        private questionnaireAssessmentService: QuestionnaireAssessmentService,
        @InjectRepository(Assessment)
        private assessmentRepository: Repository<Assessment>,
        @InjectRepository(User) private userRepository: Repository<User>,
        @InjectRepository(Caregiver)
        private caregiverRepository: Repository<Caregiver>,
        @InjectRepository(Patient)
        private patientRepository: Repository<Patient>,
        @InjectQueryService(Assessment)
        private readonly assessmentQueryService: QueryService<Assessment>,
        @InjectRepository(AssessmentType)
        private readonly assessmentTypeRepo: Repository<AssessmentType>,
        @InjectRepository(RandomizationRule)
        private readonly randomizationRuleRepository: Repository<RandomizationRule>,
        @InjectRepository(CalendarOccurrence)
        private readonly occurrenceRepository: Repository<CalendarOccurrence>,
        @InjectRepository(TreatmentCycle)
        private readonly treatmentCycleRepository: Repository<TreatmentCycle>,
        @InjectRepository(CaseHistoryEntry)
        private readonly caseHistoryEntryRepository: Repository<CaseHistoryEntry>,
        @InjectModel(Questionnaire.name)
        private readonly questionnaireModel: Model<Questionnaire>,
        @InjectModel(QuestionnaireBundle.name)
        private readonly questionnaireBundleModel: Model<QuestionnaireBundle>,
        private readonly patientQueryService: PatientQueryService,
        private readonly patientPermissionService: PatientPermissionService,
        private readonly notificationConfigurationService: NotificationConfigurationService,
        private readonly notificationDispatchService: NotificationDispatchService,
    ) {}

    private async resolveActiveClinicalTreatmentCycleId(
        patientId: number,
    ): Promise<number | undefined> {
        const cycle = await this.treatmentCycleRepository
            .createQueryBuilder('cycle')
            .where('cycle."cycleKind" = :kind', { kind: TreatmentCycleKind.CLINICAL })
            .andWhere('cycle.status = :status', { status: TreatmentCycleStatus.ACTIVE })
            .andWhere('cycle."patientId" = :patientId', { patientId })
            .orderBy('cycle."cycleNumber"', 'DESC')
            .addOrderBy('cycle."startedAt"', 'DESC')
            .getOne();

        return cycle?.id;
    }

    private async resolveActiveSupervisionTreatmentCycleId(
        therapistId: number,
    ): Promise<number | undefined> {
        const cycle = await this.treatmentCycleRepository
            .createQueryBuilder('cycle')
            .where('cycle."cycleKind" = :kind', { kind: TreatmentCycleKind.SUPERVISION })
            .andWhere('cycle.status = :status', { status: TreatmentCycleStatus.ACTIVE })
            .andWhere('cycle."therapistId" = :therapistId', { therapistId })
            .orderBy('cycle."cycleNumber"', 'DESC')
            .addOrderBy('cycle."startedAt"', 'DESC')
            .getOne();

        return cycle?.id;
    }

    getQuestionnaireAssessment(id: string) {
        return this.questionnaireAssessmentService.getById(id);
    }

    /**
     * Get assessments filter by authorized departments.
     *
     * @param query
     * @param currentUser
     * @returns
     */
    async getAssessments(
        query: AssessmentQuery,
        currentUser: User,
    ): Promise<ConnectionType<Assessment>> {
        let departmentFilter: any = {};
        const targetUserFilter = { responderUserId: { eq: currentUser.id } };
        const canViewPatients = await this.checkPermission(currentUser.id, PermissionEnum.VIEW_PATIENTS);
        const canViewAllPatients = await this.checkPermission(currentUser.id, PermissionEnum.VIEW_ALL_PATIENTS);
        const canViewDepartmentPatients = await this.checkPermission(currentUser.id, PermissionEnum.VIEW_DEPARTMENT_PATIENTS);
        const canViewAssignedPatients = await this.checkPermission(currentUser.id, PermissionEnum.VIEW_ASSIGNED_PATIENTS);

        if (!canViewPatients && !canViewAllPatients && !canViewDepartmentPatients && !canViewAssignedPatients) {
            departmentFilter = targetUserFilter;
        } else {
            const access = await this.patientPermissionService.getUserAccessScope(currentUser.id);

            if (access.type !== PatientAccessScope.ALL) {
                const patientAuthorizeFilter = await PatientAuthorizer.authorizePatient(currentUser?.id);

                const currentUsersPatients = await this.patientQueryService.query({
                    filter: patientAuthorizeFilter,
                });

                if (currentUsersPatients.length > 0) {
                    departmentFilter = {
                        or: [
                            { patientId: { in: currentUsersPatients.map(p => p.id) } },
                            targetUserFilter,
                        ],
                    };
                } else {
                    departmentFilter = targetUserFilter;
                }
            }
        }

        const combinedFilter = mergeFilter(query.filter, departmentFilter);
        query.filter = combinedFilter;

        // Apply default sort if not provided
        query.sorting = query.sorting?.length
            ? query.sorting
            : [{ field: 'id', direction: SortDirection.DESC }];

        const result: any = await AssessmentConnection.createFromPromise(
            q => this.assessmentQueryService.query(q),
            query,
            q => this.assessmentQueryService.count(q),
        );

        for (let i = 0; i < result.edges.length; i++) {
            const assessment = result.edges[i].node;
            await this.changeQuestionnaireAssessmentStatus(assessment);
        }

        return result;
    }

    async getPatientAssessments(
        patientId: number,
        currentUser: User,
        includeArchived = false,
    ): Promise<Assessment[]> {
        await this.assertCanAccessPatientAssessments(patientId, currentUser);

        const query = this.assessmentRepository
            .createQueryBuilder('assessment')
            .leftJoinAndSelect('assessment.patient', 'patient')
            .leftJoinAndSelect('assessment.targetUser', 'targetUser')
            .leftJoinAndSelect('assessment.responderUser', 'responderUser')
            .leftJoinAndSelect('assessment.clinician', 'clinician')
            .leftJoinAndSelect('assessment.responsibleUsers', 'responsibleUser')
            .leftJoinAndSelect('assessment.informantClinician', 'informantClinician')
            .leftJoinAndSelect('assessment.assessmentType', 'assessmentType')
            .leftJoinAndSelect('assessment.clinicalSession', 'clinicalSession')
            .leftJoinAndSelect('clinicalSession.calendarOccurrence', 'clinicalSessionOccurrence')
            .where('assessment."patientId" = :patientId', { patientId });

        if (!includeArchived) {
            query.andWhere('(assessment."deleted" IS NULL OR assessment."deleted" = false)');
        }

        const assessments = await query
            .orderBy('COALESCE(assessment."deliveryDate", assessment."createdAt")', 'DESC')
            .addOrderBy('assessment.id', 'DESC')
            .getMany();

        for (const assessment of assessments) {
            await this.changeQuestionnaireAssessmentStatus(assessment);
        }

        return assessments;
    }

    private async assertCanAccessPatientAssessments(
        patientId: number,
        currentUser: User,
    ): Promise<void> {
        const access = await this.patientPermissionService.getUserAccessScope(currentUser.id);
        if (access.type === PatientAccessScope.ALL) return;

        const patientAuthorizeFilter = await PatientAuthorizer.authorizePatient(currentUser.id);
        const currentUsersPatients = await this.patientQueryService.query({
            filter: patientAuthorizeFilter,
        });
        const canAccessPatient = currentUsersPatients.some(patient => patient.id === patientId);
        if (!canAccessPatient) {
            throw new NotFoundException('Patient assessments not found');
        }
    }

    /**
     * Get assessment if authorized. Throws exception if Not Found
     *
     * @param assessmentId
     * @param currentUser
     * @returns
     */
    async getAssessment(
        assessmentId: number,
        currentUser: User,
    ): Promise<Assessment> {
        // Check if user can access this assessment
        const canViewAllPatients = await this.checkPermission(currentUser.id, PermissionEnum.VIEW_ALL_PATIENTS);
        const canViewDepartmentPatients = await this.checkPermission(currentUser.id, PermissionEnum.VIEW_DEPARTMENT_PATIENTS);
        const canViewAssignedPatients = await this.checkPermission(currentUser.id, PermissionEnum.VIEW_ASSIGNED_PATIENTS);

        if (canViewAllPatients) {
            // Can access any assessment
            return await this.assessmentRepository.findOneOrFail(assessmentId);
        }

        // For other users, check if they are the target user or have access via patient
        let filter: any = { id: { eq: assessmentId } };

        if (canViewDepartmentPatients || canViewAssignedPatients) {
            const patientAuthorizeFilter = await PatientAuthorizer.authorizePatient(currentUser?.id);
            const currentUsersPatients = await this.patientQueryService.query({
                filter: patientAuthorizeFilter,
            });

            filter = {
                and: [
                    { id: { eq: assessmentId } },
                    {
                        or: [
                            { patientId: { in: currentUsersPatients.map(p => p.id) } },
                            { responderUserId: { eq: currentUser.id } },
                        ],
                    },
                ],
            };
        } else {
            // Default only see if they are the target
            filter = {
                and: [
                    { id: { eq: assessmentId } },
                    { responderUserId: { eq: currentUser.id } },
                ],
            };
        }

        const assessments = await this.assessmentQueryService.query({
            paging: { limit: 1 },
            filter,
        });

        const assessment = assessments?.[0];
        if (!assessment) {
            throw new NotFoundException();
        }

        return assessment;
    }

    async createNewAssessment(assessmentInput: CreateFullAssessmentInput, currentUser?: User) {
        const assessmentLength = assessmentInput.dates.length || 1;
        const assessmentArray = [];
        const responsibleUserIds = this.resolveAssessmentResponsibleUserIds(assessmentInput);
        if (!responsibleUserIds.length) {
            throw new BadRequestException('At least one responsible user is required');
        }
        this.syncLegacyAssessmentResponsibleField(assessmentInput, responsibleUserIds);
        await this.assertCanManageAssessmentResponsibles(
            assessmentInput.patientId,
            assessmentInput.targetUserId,
            responsibleUserIds,
            currentUser,
            'create',
        );
        await this.validateResponderUserAccess(
            assessmentInput.responderUserId,
            currentUser,
            assessmentInput.patientId,
            assessmentInput.targetUserId,
        );

        for (let i = 0; i < assessmentLength; i++) {
            let assessment: Assessment;

            const assessmentType = await this.assessmentTypeRepo.findOne(
                assessmentInput.assessmentTypeId,
            );

            if (!assessmentType) {
                throw new NotFoundException('Assessment type not found!');
            }

            if (!assessmentInput.targetUserId && !assessmentInput.patientId) {
                throw new BadRequestException(
                    'Assessment must have an evaluation target',
                );
            }
            if (!assessmentInput.responderUserId) {
                throw new BadRequestException('Assessment must be assigned to a responder user');
            }
            this.validateAssessmentContentSelection(assessmentInput);
            await this.validateAssessmentContentDepartments(assessmentInput);

            // Create mongo assessment
            const questionnaireAssessment = await this.questionnaireAssessmentService.createNewAssessment(
                assessmentInput.questionnaires || [],
                assessmentInput.questionnaireBundles || [],
                assessmentInput.randomizationRuleIds || [],
            );

            const d1 = new Date(assessmentInput?.dates[i].deliveryDate),
                d2 = new Date();

            try {
                assessment = new Assessment();

                // Set targetUserId if provided
                if (assessmentInput.targetUserId) {
                    const targetUser = await this.userRepository.findOne({
                        where: { id: assessmentInput.targetUserId },
                    });
                    if (!targetUser) {
                        throw new NotFoundException('Target user not found!');
                    }
                    assessment.targetUserId = assessmentInput.targetUserId;
                }

                const responderUser = await this.userRepository.findOne({
                    where: { id: assessmentInput.responderUserId },
                });
                if (!responderUser) {
                    throw new NotFoundException('Responder user not found!');
                }
                assessment.responderUserId = responderUser.id;
                assessment.receiverEmail = responderUser.email;

                // Set patientId if provided
                if (assessmentInput.patientId) {
                    assessment.patientId = assessmentInput.patientId;
                    assessment.treatmentCycleId =
                        assessmentInput.treatmentCycleId ||
                        await this.resolveActiveClinicalTreatmentCycleId(
                            assessmentInput.patientId,
                        );
                }

                if (!assessmentInput.dates[i].deliveryDate || d1 < d2) {
                    await this.questionnaireAssessmentService.changeAssessmentStatus(
                        questionnaireAssessment.id,
                        AssessmentStatus.OPEN_FOR_COMPLETION,
                    );
                }

                assessment.status = AssessmentStatus.OPEN_FOR_COMPLETION;
                assessment.deleted = false;
                assessment.name = assessmentInput.name?.trim() || null;
                assessment.assessmentType = assessmentType;
                assessment.clinicianId = assessmentInput.clinicianId;
                assessment.informantType = assessmentInput.informantType;
                assessment.expirationDate = assessmentInput.dates[i].expirationDate;
                assessment.note = assessmentInput.note;
                assessment.deliveryDate = assessmentInput.dates[i].deliveryDate;
                assessment.reminderMinutes = assessmentInput.dates[i].reminderMinutes || [];
                assessment.reminderUnit = assessmentInput.dates[i].reminderUnit || assessmentInput.reminderUnit || 'MINUTES';
                assessment.sentReminderMinutes = [];
                assessment.questionnaireAssessmentId = questionnaireAssessment.id;

                if (assessmentInput.informantClinicianId) {
                    const clinician = await this.userRepository.findOne({
                        where: { id: assessmentInput.informantClinicianId },
                    });
                    if (!clinician)
                        throw new NotFoundException(
                            'Informant clinician not found!',
                        );
                    assessment.informantClinician = clinician;
                    // To prevent double informant
                    assessmentInput.informantCaregiverRelation = null;
                }
                if (assessmentInput.informantCaregiverRelation) {
                    assessment.informantCaregiverRelation =
                        assessmentInput.informantCaregiverRelation;
                }
                await this.configureAssessmentAssignmentEmail(
                    assessment,
                    assessmentInput,
                    responderUser,
                    assessmentInput.dates[i].deliveryDate,
                );

                await assessment.save();
                await this.setAssessmentResponsibleUsers(
                    assessment,
                    responsibleUserIds,
                );
                await this.recordAssessmentNoteHistory(assessment, currentUser);
                assessmentArray.push(assessment);
            } catch (err) {
                await questionnaireAssessment.remove();
                throw err;
            }
        }

        return assessmentArray[0];
    }

    /**
     * Retrieve Postgres Assessment with link to patients and clinicians and mongodb Assessment with link to questionnaires
     * @param assessmentId
     * @returns
     */
    async getFullAssessment(assessmentId: number, currentUser?: User): Promise<FullAssessment> {
        if (currentUser) {
            await this.getAssessment(assessmentId, currentUser);
        }

        const assessment: FullAssessment = (await this.assessmentRepository.findOne(
            {
                where: {
                    id: assessmentId,
                    isActive: true,
                },
                relations: [
                    'clinician',
                    'patient',
                    'targetUser',
                    'responderUser',
                    'informantClinician',
                    'responsibleUsers',
                    'assessmentType',
                ],
            },
        )) as FullAssessment;

        assessment.questionnaireAssessment = await this.questionnaireAssessmentService.getById(
            assessment.questionnaireAssessmentId,
        );

        return assessment;
    }

    async updateAssessment(assessmentInput: UpdateFullAssessmentInput, currentUser?: User) {
        const responsibleUserIds = this.resolveAssessmentResponsibleUserIds(assessmentInput);
        if (!responsibleUserIds.length) {
            throw new BadRequestException('At least one responsible user is required');
        }
        this.syncLegacyAssessmentResponsibleField(assessmentInput, responsibleUserIds);
        await this.assertCanManageAssessmentResponsibles(
            assessmentInput.patientId,
            assessmentInput.targetUserId,
            responsibleUserIds,
            currentUser,
            'edit',
        );
        await this.validateResponderUserAccess(
            assessmentInput.responderUserId,
            currentUser,
            assessmentInput.patientId,
            assessmentInput.targetUserId,
        );

        // find postgres assessment
        const assessment = await this.assessmentRepository.findOneOrFail(
            assessmentInput.assessmentId,
        );
        const previousAssessmentNote = assessment.note;

        const assessmentType = await this.assessmentTypeRepo.findOne(
            assessmentInput.assessmentTypeId,
        );

        if (!assessmentType)
            throw new NotFoundException('Assessment type not found!');

        if (!assessmentInput.targetUserId && !assessmentInput.patientId) {
            throw new BadRequestException(
                'Assessment must have an evaluation target',
            );
        }
        if (!assessmentInput.responderUserId) {
            throw new BadRequestException('Assessment must be assigned to a responder user');
        }
        this.validateAssessmentContentSelection(assessmentInput);
        await this.validateAssessmentContentDepartments(assessmentInput);

        // find & update mongo assessment
        let questionnaireAssessment = await this.questionnaireAssessmentService.getById(
            assessment.questionnaireAssessmentId,
        );
        const originalQuestionnaires = [
            ...questionnaireAssessment.questionnaires,
        ] as Types.ObjectId[];
        const originalQuestionnaireBundles = [
            ...(questionnaireAssessment.questionnaireBundles || []),
        ] as Types.ObjectId[];
        const originalRandomizationRuleIds = [
            ...(questionnaireAssessment.randomizationRuleIds || []),
        ];
        const originalResolvedQuestionnaires = [
            ...(questionnaireAssessment.resolvedQuestionnaires || []),
        ];
        questionnaireAssessment = await this.questionnaireAssessmentService.updateAssessment(
            questionnaireAssessment,
            assessmentInput.questionnaires,
            assessmentInput.questionnaireBundles,
            assessmentInput.randomizationRuleIds || [],
        );

        const d1 = new Date(assessmentInput?.deliveryDate),
            d2 = new Date();

        if (!assessmentInput.deliveryDate || d1 < d2) {
            await this.questionnaireAssessmentService.changeAssessmentStatus(
                questionnaireAssessment.id,
                AssessmentStatus.OPEN_FOR_COMPLETION,
            );
        }

        try {
            // update postgres assessment
            assessment.assessmentType = assessmentType;
            assessment.patientId = assessmentInput.patientId || null;
            assessment.targetUserId = assessmentInput.targetUserId || null;
            assessment.responderUserId = assessmentInput.responderUserId;
            const responderUser = await this.userRepository.findOne({
                where: { id: assessment.responderUserId },
            });
            if (!responderUser) {
                throw new NotFoundException('Responder user not found!');
            }
            assessment.receiverEmail = responderUser.email;
            assessment.clinicianId = assessmentInput.clinicianId;
            assessment.informantType = assessmentInput.informantType;
            assessment.questionnaireAssessmentId = questionnaireAssessment.id;
            assessment.name = assessmentInput.name?.trim() || null;
            assessment.expirationDate = assessmentInput.expirationDate;
            assessment.deliveryDate = assessmentInput.deliveryDate;
            assessment.reminderMinutes = assessmentInput.reminderMinutes || [];
            assessment.reminderUnit = assessmentInput.reminderUnit || 'MINUTES';
            assessment.sentReminderMinutes = assessment.sentReminderMinutes || [];
            assessment.note = assessmentInput.note;
            assessment.informantCaregiverRelation = null;
            assessment.informantClinician = null;
            if (assessmentInput.informantClinicianId) {
                const clinician = await this.userRepository.findOne({
                    where: { id: assessmentInput.informantClinicianId },
                });
                if (!clinician)
                    throw new NotFoundException(
                        'Informant clinician not found!',
                    );
                assessment.informantClinician = clinician;
                // To prevent double informant
                assessmentInput.informantCaregiverRelation = null;
            }
            if (assessmentInput.informantCaregiverRelation) {
                assessment.informantCaregiverRelation =
                    assessmentInput.informantCaregiverRelation;
            }
            await this.configureAssessmentAssignmentEmail(
                assessment,
                assessmentInput,
                responderUser,
                assessmentInput.deliveryDate,
            );
            await assessment.save();
            await this.setAssessmentResponsibleUsers(
                assessment,
                responsibleUserIds,
            );
            await this.syncCalendarOccurrenceForUpdatedAssessment(assessment);
            await this.recordAssessmentNoteHistory(assessment, currentUser, previousAssessmentNote);
        } catch (err) {
            // undo mongo changes
            questionnaireAssessment.questionnaires = originalQuestionnaires;
            questionnaireAssessment.questionnaireBundles = originalQuestionnaireBundles;
            questionnaireAssessment.randomizationRuleIds = originalRandomizationRuleIds;
            questionnaireAssessment.resolvedQuestionnaires = originalResolvedQuestionnaires;
            await questionnaireAssessment.save();
            throw err;
        }

        return assessment;
    }

    private async syncCalendarOccurrenceForUpdatedAssessment(
        assessment: Assessment,
    ): Promise<void> {
        if (!assessment.calendarOccurrenceId) return;
        if (!assessment.deliveryDate || !assessment.expirationDate) return;

        await this.occurrenceRepository.update(
            assessment.calendarOccurrenceId,
            {
                startAt: assessment.deliveryDate,
                endAt: assessment.expirationDate,
                isDetachedFromTemplate: true,
            },
        );
    }

    public async deleteAssessment(id: number, statusCancel = true, currentUser?: User) {
        const assessment = await this.assessmentRepository.findOneOrFail(id);
        if (currentUser) {
            await this.assertCanManageAssessmentEntity(assessment, currentUser);
            if (assessment.origin === AssessmentOrigin.SESSION_BASED) {
                throw new BadRequestException('Session based assessments must be managed from the session');
            }
        }
        const queryRunner = getConnection().createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        if (statusCancel) {
            assessment.status = AssessmentStatus.CANCELLED;
            await queryRunner.manager.save(assessment);
        } else {
            await queryRunner.manager.delete(Assessment, id);
        }

        try {
            await this.questionnaireAssessmentService.deleteAssessment(
                (assessment.questionnaireAssessmentId as any) as Types.ObjectId,
                statusCancel,
            );
            await queryRunner.commitTransaction();
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    private async configureAssessmentAssignmentEmail(
        assessment: Assessment,
        assessmentInput: CreateFullAssessmentInput | UpdateFullAssessmentInput,
        responderUser: User,
        deliveryDate?: Date,
    ): Promise<void> {
        assessment.receiverEmail = responderUser.email || assessmentInput.receiverEmail || null;
        assessment.mailTemplateId = null;
        assessment.emailReminder = !!(assessmentInput.reminderMinutes || []).length;

        if (!Validator.isEmail(assessment.receiverEmail)) {
            assessment.emailStatus = AssessmentEmailStatus.NOT_SCHEDULED;
            return;
        }

        const mailTemplate = await this.notificationConfigurationService.resolveAssessmentAssignedMailTemplate({
            responderUserId: responderUser.id,
            patientId: assessmentInput.patientId,
            targetUserId: assessmentInput.targetUserId,
        });

        if (!mailTemplate) {
            await this.notificationDispatchService.recordLog({
                channel: NotificationChannel.EMAIL,
                event: NotificationEvent.ASSESSMENT_ASSIGNED,
                status: NotificationLogStatus.SKIPPED_NO_CONFIGURATION,
                recipientId: responderUser.id,
                recipientEmail: assessment.receiverEmail,
                message: 'No active notification configuration found for assessment assignment.',
                metadata: {
                    assessmentId: assessment.id,
                    patientId: assessmentInput.patientId,
                    targetUserId: assessmentInput.targetUserId,
                    responderUserId: responderUser.id,
                },
            });
            assessment.emailStatus = AssessmentEmailStatus.NOT_SCHEDULED;
            return;
        }

        assessment.mailTemplateId = mailTemplate.id;
        assessment.emailStatus = AssessmentEmailStatus.SCHEDULED;
    }

    private async recordAssessmentNoteHistory(
        assessment: Assessment,
        currentUser?: User,
        previousNote?: string,
    ): Promise<void> {
        const note = (assessment.note || '').trim();
        if (!note) return;
        if (previousNote !== undefined && (previousNote || '').trim() === note) return;

        const cycleKind = assessment.patientId
            ? TreatmentCycleKind.CLINICAL
            : TreatmentCycleKind.SUPERVISION;
        const treatmentCycleId = assessment.treatmentCycleId ||
            (assessment.patientId
                ? await this.resolveActiveClinicalTreatmentCycleId(assessment.patientId)
                : assessment.targetUserId
                    ? await this.resolveActiveSupervisionTreatmentCycleId(assessment.targetUserId)
                    : undefined);
        if (!treatmentCycleId) return;

        const assessmentWithType = await this.assessmentRepository.findOne(assessment.id, {
            relations: ['assessmentType'],
        });
        const assessmentName = (assessment.name || assessmentWithType?.name || '').trim();
        const assessmentTypeName = assessmentWithType?.assessmentType?.name ||
            (assessment.assessmentTypeId
                ? (await this.assessmentTypeRepo.findOne(assessment.assessmentTypeId))?.name
                : undefined);
        const assessmentLabel = assessmentName || assessmentTypeName || `Evaluación ${assessment.id}`;
        const noteTitle = assessment.patientId
            ? `Nota clínica de evaluación: ${assessmentLabel}`
            : `Nota de supervisión de evaluación: ${assessmentLabel}`;

        await this.caseHistoryEntryRepository.save(
            this.caseHistoryEntryRepository.create({
                entryKind: CaseHistoryEntryKind.NOTE,
                cycleKind,
                patientId: assessment.patientId || null,
                therapistId: assessment.patientId ? null : assessment.targetUserId || null,
                treatmentCycleId,
                occurredAt: assessment.deliveryDate || new Date(),
                title: noteTitle,
                content: note,
                metadata: {
                    assessmentId: assessment.id,
                    assessmentTypeId: assessment.assessmentTypeId,
                    assessmentName,
                    assessmentTypeName,
                    questionnaireAssessmentId: assessment.questionnaireAssessmentId,
                    createdByUserId: currentUser?.id,
                },
            }),
        );
    }

    async archiveOneAssessment(id: number, currentUser?: User) {
        const assessment = await this.assessmentRepository.findOneOrFail(id);
        if (currentUser) {
            await this.assertCanManageAssessmentEntity(assessment, currentUser);
        }

        if (assessment.deleted) {
            throw Error('This assessment is already archived!');
        }

        await this.assessmentRepository.update(id, { deleted: true });

        return assessment;
    }

    async restoreOneAssessment(id: number, currentUser?: User) {
        const assessment = await this.assessmentRepository
            .createQueryBuilder('assessment')
            .leftJoinAndSelect('assessment.patient', 'patient')
            .where('assessment.id = :id', { id })
            .getOneOrFail();
        if (currentUser) {
            await this.assertCanManageAssessmentEntity(assessment, currentUser);
        }

        if (assessment.patient.deleted) {
            throw Error('The patient assigned to this assessment is archived!');
        }

        if (!assessment.deleted) {
            throw Error('This assessment is not archived!');
        }

        await this.assessmentRepository.update(id, { deleted: false });
        delete assessment.patient;
        return assessment;
    }

    async getFullPublicAssessment(uuid: string): Promise<FullPublicAssessment> {
        const assessment = (await this.assessmentRepository.findOne(
            {
                where: {
                    isActive: true,
                    uuid,
                },
                relations: ['assessmentType'],
            },
        ) as unknown as FullPublicAssessment);

        assessment.questionnaireAssessment = await this.changeQuestionnaireAssessmentStatus(
            assessment,
        );

        return assessment;
    }

    async changeQuestionnaireAssessmentStatus(assessment: any) {
        const questionnaireAssessment = await this.questionnaireAssessmentService.getById(
            assessment.questionnaireAssessmentId.toString(),
        );

        const expirationToDate = new Date(assessment?.expirationDate);
        const deliveryToDate = new Date(assessment?.deliveryDate);
        const newDate = new Date();

        if (
            questionnaireAssessment.status === AssessmentStatus.PLANNED &&
            assessment?.deliveryDate &&
            deliveryToDate < newDate
        ) {
            await this.questionnaireAssessmentService.changeAssessmentStatus(
                assessment.questionnaireAssessmentId,
                AssessmentStatus.OPEN_FOR_COMPLETION,
            );
            await this.assessmentRepository.update(
                { id: assessment.id },
                { status: AssessmentStatus.OPEN_FOR_COMPLETION },
            );
            questionnaireAssessment.status =
                AssessmentStatus.OPEN_FOR_COMPLETION;
        }

        if (
            assessment?.expirationDate &&
            expirationToDate < newDate &&
            questionnaireAssessment?.status !== AssessmentStatus.COMPLETED &&
            questionnaireAssessment?.status !==
                AssessmentStatus.PARTIALLY_COMPLETED
        ) {
            await this.questionnaireAssessmentService.changeAssessmentStatus(
                assessment.questionnaireAssessmentId,
                AssessmentStatus.EXPIRED,
            );
            await this.assessmentRepository.update(
                { id: assessment.id },
                { status: AssessmentStatus.EXPIRED },
            );
            questionnaireAssessment.status = AssessmentStatus.EXPIRED;
        }

        return questionnaireAssessment;
    }

    // Helper method to check permissions
    private async checkPermission(userId: number, permission: string): Promise<boolean> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ['permissions', 'roles', 'roles.permissions'],
        });
        if (!user) return false;

        return user.permissions?.some(p => p.name === permission) ||
               user.roles?.some(r => r.permissions?.some(p => p.name === permission));
    }

    private resolveAssessmentResponsibleUserIds(
        input: Pick<CreateFullAssessmentInput, 'responsibleUserIds' | 'clinicianId'>,
    ): number[] {
        return this.uniqueIds([...(input.responsibleUserIds || []), input.clinicianId]);
    }

    private syncLegacyAssessmentResponsibleField(
        input: CreateFullAssessmentInput,
        responsibleUserIds: number[],
    ): void {
        const primaryResponsibleUserId = responsibleUserIds[0];
        if (primaryResponsibleUserId) {
            input.clinicianId = primaryResponsibleUserId;
        }
    }

    private async setAssessmentResponsibleUsers(
        assessment: Assessment,
        responsibleUserIds: number[],
    ): Promise<void> {
        const users = responsibleUserIds.length
            ? await this.userRepository.find({ where: { id: In(responsibleUserIds) } })
            : [];
        if (users.length !== responsibleUserIds.length) {
            throw new BadRequestException('One or more responsible users were not found');
        }
        assessment.responsibleUsers = users;
        await this.assessmentRepository.save(assessment);

        if (assessment.calendarOccurrenceId) {
            const occurrence = await this.occurrenceRepository.findOne(
                assessment.calendarOccurrenceId,
            );
            if (occurrence) {
                occurrence.therapistId = assessment.clinicianId;
                occurrence.responsibleUsers = users;
                await this.occurrenceRepository.save(occurrence);
            }
        }
    }

    private async assertCanManageAssessmentResponsibles(
        patientId: number | undefined,
        targetUserId: number | undefined,
        responsibleUserIds: number[],
        currentUser: User | undefined,
        action: 'create' | 'edit',
    ): Promise<void> {
        if (!currentUser) return;

        if (
            await this.canManageAssessmentTargetByScope(
                currentUser,
                patientId,
                targetUserId,
            )
        ) {
            return;
        }

        if (patientId) {
            const caseManagerIds = await this.caseManagerIdsForPatient(patientId);
            if (!caseManagerIds.includes(currentUser.id)) {
                throw new BadRequestException(`Only case administrators can ${action} assessments for this patient`);
            }
            const invalidResponsibleIds = responsibleUserIds.filter(id => !caseManagerIds.includes(id));
            if (invalidResponsibleIds.length) {
                throw new BadRequestException(
                    `Assessment responsible users must be case administrators. Invalid user IDs: ${invalidResponsibleIds.join(', ')}`,
                );
            }
            return;
        }

        if (!targetUserId) return;
        if (targetUserId === currentUser.id) {
            const invalidResponsibleIds = responsibleUserIds.filter(id => id !== currentUser.id);
            if (invalidResponsibleIds.length) {
                throw new BadRequestException('Self assessments can only be assigned to the current user');
            }
            return;
        }

        const supervisorIds = await this.supervisorIdsForTherapist(targetUserId);
        if (!supervisorIds.includes(currentUser.id)) {
            throw new BadRequestException(`Only supervisors can ${action} assessments for this therapist`);
        }
        const invalidResponsibleIds = responsibleUserIds.filter(id => !supervisorIds.includes(id));
        if (invalidResponsibleIds.length) {
            throw new BadRequestException(
                `Assessment responsible users must be supervisors of the therapist. Invalid user IDs: ${invalidResponsibleIds.join(', ')}`,
            );
        }
    }

    private async assertCanManageAssessmentEntity(
        assessment: Assessment,
        currentUser: User,
    ): Promise<void> {
        if (
            await this.canManageAssessmentTargetByScope(
                currentUser,
                assessment.patientId,
                assessment.targetUserId,
            )
        ) {
            return;
        }
        const responsibleUserIds = this.uniqueIds([
            ...(assessment.responsibleUsers || []).map(user => user.id),
            assessment.clinicianId,
        ]);
        await this.assertCanManageAssessmentResponsibles(
            assessment.patientId,
            assessment.targetUserId,
            responsibleUserIds,
            currentUser,
            'edit',
        );
    }

    private async canManageAssessmentTargetByScope(
        currentUser: User,
        patientId?: number,
        targetUserId?: number,
    ): Promise<boolean> {
        if (await this.checkPermission(currentUser.id, PermissionEnum.MANAGE_ALL_ASSESSMENTS)) {
            return true;
        }
        if (!(await this.checkPermission(currentUser.id, PermissionEnum.MANAGE_DEPARTMENT_ASSESSMENTS))) {
            return false;
        }

        const [manager, patient, targetUser] = await Promise.all([
            this.userRepository.findOne({
                where: { id: currentUser.id },
                relations: ['departments'],
            }),
            patientId
                ? this.patientRepository.findOne(patientId, { relations: ['departments'] })
                : Promise.resolve(undefined),
            targetUserId
                ? this.userRepository.findOne({
                    where: { id: targetUserId },
                    relations: ['departments'],
                })
                : Promise.resolve(undefined),
        ]);
        const managerDepartmentIds = manager?.departments?.map(department => department.id) || [];
        const targetDepartmentIds = patient?.departments?.map(department => department.id) ||
            targetUser?.departments?.map(department => department.id) ||
            [];
        return targetDepartmentIds.some(id => managerDepartmentIds.includes(id));
    }

    private async caseManagerIdsForPatient(patientId: number): Promise<number[]> {
        const patient = await this.patientRepository.findOne(patientId, {
            relations: ['caseManagers'],
        });
        return patient?.caseManagers?.map(user => user.id) || [];
    }

    private async supervisorIdsForTherapist(therapistId: number): Promise<number[]> {
        const rows = await getManager()
            .createQueryBuilder()
            .select('"supervisorId"', 'supervisorId')
            .from('therapist_supervisor', 'therapistSupervisor')
            .where('"therapistId" = :therapistId', { therapistId })
            .getRawMany();
        return rows.map(row => Number(row.supervisorId)).filter(id => Number.isFinite(id));
    }

    private uniqueIds(ids: Array<number | undefined | null>): number[] {
        return [...new Set(
            ids
                .map(id => Number(id))
                .filter(id => Number.isFinite(id) && id > 0),
        )];
    }

    private async validateResponderUserAccess(
        targetUserId?: number,
        currentUser?: User,
        patientId?: number,
        assessmentTargetUserId?: number,
    ): Promise<void> {
        if (!targetUserId || !currentUser) return;

        if (await this.checkPermission(currentUser.id, PermissionEnum.ASSIGN_ANY_ASSESSMENT_USER)) {
            return;
        }

        if (assessmentTargetUserId === targetUserId) {
            return;
        }

        if (patientId) {
            const patient = await this.patientRepository.findOne(patientId, {
                relations: ['caseManagers'],
            });

            if (patient?.userId === targetUserId || patient?.caseManagers?.some(user => user.id === targetUserId)) {
                return;
            }

            const caregiver = await this.caregiverRepository.findOne({
                where: { userId: targetUserId },
                relations: ['patientCaregivers'],
            });

            if (caregiver?.patientCaregivers?.some(relation => relation.patientId === patientId)) {
                return;
            }
        }

        const [assigner, targetUser] = await Promise.all([
            this.userRepository.findOne({
                where: { id: currentUser.id },
                relations: ['departments'],
            }),
            this.userRepository.findOne({
                where: { id: targetUserId },
                relations: ['departments'],
            }),
        ]);

        if (!targetUser) {
            throw new NotFoundException('Target user not found!');
        }

        const assignerDepartmentIds = assigner?.departments?.map(department => department.id) ?? [];
        const targetDepartmentIds = targetUser.departments?.map(department => department.id) ?? [];
        const hasSharedDepartment = targetDepartmentIds.some(id => assignerDepartmentIds.includes(id));

        if (!hasSharedDepartment && targetUser.id !== currentUser.id) {
            throw new BadRequestException('Assessment can only be assigned to a visible user.');
        }
    }

    private validateAssessmentContentSelection(
        assessmentInput: Pick<CreateFullAssessmentInput, 'questionnaires' | 'questionnaireBundles' | 'randomizationRuleIds'>,
    ): void {
        const questionnaireCount = assessmentInput.questionnaires?.length || 0;
        const bundleCount = assessmentInput.questionnaireBundles?.length || 0;
        const randomizationCount = assessmentInput.randomizationRuleIds?.length || 0;
        const totalSelectionCount = questionnaireCount + bundleCount + randomizationCount;

        if (!totalSelectionCount) {
            throw new BadRequestException(
                'Assessment must include one questionnaire, one questionnaire bundle or one randomization',
            );
        }

        if (totalSelectionCount > 1) {
            throw new BadRequestException(
                'Choose either one questionnaire, one questionnaire bundle, or one randomization',
            );
        }
    }

    private async validateAssessmentContentDepartments(
        assessmentInput: Pick<CreateFullAssessmentInput, 'patientId' | 'targetUserId' | 'questionnaires' | 'questionnaireBundles' | 'randomizationRuleIds'>,
    ): Promise<void> {
        const targetDepartmentIds = await this.getAssessmentTargetDepartmentIds(
            assessmentInput.patientId,
            assessmentInput.targetUserId,
        );

        if (assessmentInput.questionnaires?.length) {
            const questionnaires = await this.questionnaireModel.find({
                _id: { $in: assessmentInput.questionnaires.map(id => Types.ObjectId(String(id))) },
                zombie: { $ne: true },
            }).select('_id name departmentIds');
            if (questionnaires.length !== assessmentInput.questionnaires.length) {
                throw new NotFoundException('One of the questionnaires does not exist');
            }
            const incompatibleQuestionnaire = questionnaires.find(questionnaire =>
                !areDepartmentsCompatible(targetDepartmentIds, questionnaire.departmentIds),
            );
            if (incompatibleQuestionnaire) {
                throw new BadRequestException(
                    `Questionnaire "${incompatibleQuestionnaire.name}" is not compatible with the target departments`,
                );
            }
        }

        if (assessmentInput.questionnaireBundles?.length) {
            const bundles = await this.questionnaireBundleModel.find({
                _id: { $in: assessmentInput.questionnaireBundles.map(id => Types.ObjectId(String(id))) },
                deleted: { $ne: true },
            }).select('_id name departmentIds');
            if (bundles.length !== assessmentInput.questionnaireBundles.length) {
                throw new NotFoundException('One of the questionnaire bundles does not exist');
            }
            const incompatibleBundle = bundles.find(bundle =>
                !areDepartmentsCompatible(targetDepartmentIds, bundle.departmentIds),
            );
            if (incompatibleBundle) {
                throw new BadRequestException(
                    `Questionnaire bundle "${incompatibleBundle.name}" is not compatible with the target departments`,
                );
            }
        }

        if (assessmentInput.randomizationRuleIds?.length) {
            const randomizations = await this.randomizationRuleRepository.find({
                where: { id: In(assessmentInput.randomizationRuleIds) },
                relations: ['departments'],
            });
            if (randomizations.length !== assessmentInput.randomizationRuleIds.length) {
                throw new NotFoundException('One of the randomizations does not exist');
            }
            const incompatibleRandomization = randomizations.find(randomization =>
                !areDepartmentsCompatible(
                    targetDepartmentIds,
                    randomization.departments?.map(department => department.id) || [],
                ),
            );
            if (incompatibleRandomization) {
                throw new BadRequestException(
                    `Randomization "${incompatibleRandomization.name}" is not compatible with the target departments`,
                );
            }
        }
    }

    private async getAssessmentTargetDepartmentIds(patientId?: number, targetUserId?: number): Promise<number[]> {
        if (patientId) {
            const patient = await this.patientRepository.findOne(patientId, {
                relations: ['departments'],
            });
            return patient?.departments?.map(department => department.id) || [];
        }

        if (targetUserId) {
            const targetUser = await this.userRepository.findOne(targetUserId, {
                relations: ['departments'],
            });
            return targetUser?.departments?.map(department => department.id) || [];
        }

        return [];
    }
}
