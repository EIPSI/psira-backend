import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Types } from 'mongoose';
import { getConnection, Repository } from 'typeorm';
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
import { Validator } from 'src/shared';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';

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
        private readonly patientQueryService: PatientQueryService,
        private readonly patientPermissionService: PatientPermissionService,
    ) {}

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
        // Aplicar filtro de departamento si el usuario no tiene acceso total
        const access = await this.patientPermissionService.getUserAccessScope(currentUser.id);

        let departmentFilter: any = {};
        const targetUserFilter = { responderUserId: { eq: currentUser.id } };

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

            // Create mongo assessment
            const questionnaireAssessment = await this.questionnaireAssessmentService.createNewAssessment(
                assessmentInput.questionnaires,
                assessmentInput.questionnaireBundles
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
                }

                if (!assessmentInput.dates[i].deliveryDate || d1 < d2) {
                    await this.questionnaireAssessmentService.changeAssessmentStatus(
                        questionnaireAssessment.id,
                        AssessmentStatus.OPEN_FOR_COMPLETION,
                    );
                }

                assessment.status = AssessmentStatus.OPEN_FOR_COMPLETION;
                assessment.assessmentType = assessmentType;
                assessment.clinicianId = assessmentInput.clinicianId;
                assessment.informantType = assessmentInput.informantType;
                assessment.expirationDate = assessmentInput.dates[i].expirationDate;
                assessment.note = assessmentInput.note;
                assessment.deliveryDate = assessmentInput.dates[i].deliveryDate;
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
                // If emailReminder is not checked then all the other email values will be edited
                assessment.emailReminder =
                    assessmentInput.emailReminder || false;
                if (!assessmentInput.emailReminder) {
                    assessment.emailStatus =
                        AssessmentEmailStatus.NOT_SCHEDULED;
                    assessment.receiverEmail = assessment.receiverEmail || assessmentInput.receiverEmail || null;
                } else if (Validator.isEmail(assessmentInput.receiverEmail)) {
                    if (!assessmentInput.mailTemplateId) {
                        throw new Error('Mail template not found!');
                    }
                    assessment.mailTemplateId = assessmentInput.mailTemplateId;

                    if (!assessmentInput.dates[i].deliveryDate) {
                        assessment.emailStatus =
                            AssessmentEmailStatus.NOT_SCHEDULED;
                    } else {
                        assessment.emailStatus =
                            AssessmentEmailStatus.SCHEDULED;
                    }
                    assessment.receiverEmail = assessmentInput.receiverEmail;
                }

                await assessment.save();
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

        // find & update mongo assessment
        let questionnaireAssessment = await this.questionnaireAssessmentService.getById(
            assessment.questionnaireAssessmentId,
        );
        const originalQuestionnaires = [
            ...questionnaireAssessment.questionnaires,
        ] as Types.ObjectId[];
        questionnaireAssessment = await this.questionnaireAssessmentService.updateAssessment(
            questionnaireAssessment,
            assessmentInput.questionnaires,
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
            assessment.expirationDate = assessmentInput.expirationDate;
            assessment.deliveryDate = assessmentInput.deliveryDate;
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
            // If emailReminder is not checked then all the other email values will be edited
            assessment.emailReminder = assessmentInput.emailReminder || false;
            if (!assessmentInput.emailReminder) {
                assessment.emailStatus = AssessmentEmailStatus.NOT_SCHEDULED;
                assessment.receiverEmail = assessment.receiverEmail || assessmentInput.receiverEmail || null;
                assessment.mailTemplateId = null;
            } else if (Validator.isEmail(assessmentInput.receiverEmail)) {
                if (!assessmentInput.mailTemplateId) {
                    throw new Error('Mail template not found!');
                }
                assessment.mailTemplateId = assessmentInput.mailTemplateId;

                if (!assessmentInput.deliveryDate) {
                    assessment.emailStatus =
                        AssessmentEmailStatus.NOT_SCHEDULED;
                } else {
                    assessment.emailStatus = AssessmentEmailStatus.SCHEDULED;
                }
                assessment.receiverEmail = assessmentInput.receiverEmail;
            }
            await assessment.save();
        } catch (err) {
            // undo mongo changes
            await this.questionnaireAssessmentService.updateAssessment(
                questionnaireAssessment,
                originalQuestionnaires,
            );
            throw err;
        }

        return assessment;
    }

    public async deleteAssessment(id: number, statusCancel = true) {
        const assessment = await this.assessmentRepository.findOneOrFail(id);
        const queryRunner = getConnection().createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        if (!statusCancel) await queryRunner.manager.delete(Assessment, id);

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

    async archiveOneAssessment(id: number) {
        const assessment = await this.assessmentRepository.findOneOrFail(id);

        if (assessment.deleted) {
            throw Error('This assessment is already archived!');
        }

        await this.assessmentRepository.update(id, { deleted: true });

        return assessment;
    }

    async restoreOneAssessment(id: number) {
        const assessment = await this.assessmentRepository
            .createQueryBuilder('assessment')
            .leftJoinAndSelect('assessment.patient', 'patient')
            .where('assessment.id = :id', { id })
            .getOneOrFail();

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
}
