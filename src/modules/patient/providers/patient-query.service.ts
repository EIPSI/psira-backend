import { QueryService, mergeFilter } from '@nestjs-query/core';
import { TypeOrmQueryService } from '@nestjs-query/query-typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient, PatientReport } from '../models/patient.model';
import { CreatePatientInput } from '../dto/create-patient.input';
import { User } from 'src/modules/user/models/user.model';
import { UserCrudService } from 'src/modules/user/providers/user-crud.service';
import { Role } from 'src/modules/permission/models/role.model';
import { RoleCode } from 'src/modules/permission/enums/role-code.enum';
import { PatientAuthorizer } from '../authorizers/patient.authorizer';
import { Inject, NotFoundException } from '@nestjs/common';
import { QuestionnaireAssessmentService } from 'src/modules/questionnaire/services/questionnaire-assessment.service';
import { QuestionnaireAssessment } from 'src/modules/questionnaire/models/questionnaire-assessment.schema';
import { IAnswerMap } from 'src/modules/questionnaire/models/answer.schema';
import {
    AnsweredQuestions,
    IQuestionGroup,
} from 'src/modules/questionnaire/models/questionnaire.schema';
import {
    Assessment,
    AssessmentResponse,
} from 'src/modules/assessment/models/assessment.model';
import { QuestionnaireScriptService } from 'src/modules/questionnaire/services/questionnaire-script.service';
import { Exception } from 'handlebars';

@QueryService(Patient)
export class PatientQueryService extends TypeOrmQueryService<Patient> {
    @Inject(QuestionnaireAssessmentService)
    questionnaireAssessmentService: QuestionnaireAssessmentService;
    @Inject(QuestionnaireScriptService)
    questionnaireScriptService: QuestionnaireScriptService;

    @Inject(UserCrudService)
    private readonly userCrudService: UserCrudService;

    constructor(@InjectRepository(Patient) repo: Repository<Patient>) {
        // pass the use soft delete option to the service.
        super(repo);
    }

    /**
     * Get patient if authorized. Throws exception if Not Found
     *
     * @param currentUser
     * @param patientId
     * @returns
     *
     * @throws NotFoundException
     */
    async getOnePatient(currentUser: User, patientId: number) {
        const authorizeFilter = await PatientAuthorizer.authorizePatient(
            currentUser?.id,
        );

        const combinedFilter = mergeFilter(
            { id: { eq: patientId } },
            authorizeFilter,
        );

        const patients = await super.query({
            paging: { limit: 1 },
            filter: combinedFilter,
        });

        const patient = patients?.[0];

        if (!patient) {
            throw new NotFoundException();
        }

        return patient;
    }

    async createOne(input: CreatePatientInput): Promise<Patient> {
        const patient = await super.createOne(input);

        // Handle department assignment (existing logic)
        if (input.departmentIds) {
            await super.addRelations(
                'departments',
                patient.id,
                input.departmentIds,
            );
        }

        // Handle case manager assignment (new logic)
        if (input.caseManagerIds && input.caseManagerIds.length > 0) {
            await super.addRelations(
                'caseManagers',
                patient.id,
                input.caseManagerIds,
            );
        }

        // Auto-create user if patient has email
        if (input.email) {
            try {
                // Generate username from email (before @)
                const username = input.email.split('@')[0];

                // Create user with PATIENT role
                const newUser = await this.userCrudService.createOne({
                    username: username,
                    email: input.email,
                    firstName: input.firstName,
                    lastName: input.lastName,
                    password: this.generateRandomPassword(), // Temporal password
                });

                // Assign PATIENT role
                const patientRole = await Role.findOne({ code: RoleCode.PATIENT });
                if (patientRole) {
                    newUser.roles = [patientRole];
                    await newUser.save();
                }

                // Link patient to user
                await this.repo.update(patient.id, { userId: newUser.id });
                patient.userId = newUser.id;

                // TODO: Send welcome email with login instructions
                // This requires implementing email service integration
                // await this.sendWelcomeEmail(newUser, input.email);

            } catch (error) {
                // Log error but don't fail patient creation
                console.error('Failed to create user for patient:', error);
                // Optionally: set a flag on patient to indicate user creation failed
            }
        }

        return patient;
    }

    private generateRandomPassword(): string {
        // Generate a temporary random password
        // Patient will need to change it on first login
        const length = 12;
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return password;
    }

    async archiveOnePatient(id: number, patient: Patient) {
        if (patient.deleted) {
            throw Error('This patient is already archived!');
        }

        await this.repo.update(id, { deleted: true });
        await Assessment.update({ patientId: id }, { deleted: true });

        return patient;
    }

    async restoreOnePatient(id: number, patient: Patient) {
        if (!patient.deleted) {
            throw Error('This patient is not archived!');
        }

        await this.repo.update(id, { deleted: false });
        await Assessment.update({ patientId: id }, { deleted: false });

        return patient;
    }

    async updateCaseManagers(
        patientId: number,
        caseManagerIds: number[],
    ): Promise<void> {
        // First, remove all existing case managers
        await this.repo
            .createQueryBuilder()
            .delete()
            .from('patient_case_manager')
            .where('patientId = :patientId', { patientId })
            .execute();

        // Then, add new case managers if any
        if (caseManagerIds && caseManagerIds.length > 0) {
            for (const cmId of caseManagerIds) {
                await this.repo
                    .createQueryBuilder()
                    .insert()
                    .into('patient_case_manager')
                    .values({ patientId, userId: cmId })
                    .execute();
            }
        }
    }

    async createMany(input: CreatePatientInput[]): Promise<Patient[]> {
        const patients = await super.createMany(input);

        for (let i = 0; i < patients.length; i++) {
            const patient = patients[i];
            const patientInput = input[i];

            if (patientInput.departmentIds) {
                await super.addRelations(
                    'departments',
                    patient.id,
                    patientInput.departmentIds,
                );
            }

            if (patientInput.caseManagerIds && patientInput.caseManagerIds.length > 0) {
                await super.addRelations(
                    'caseManagers',
                    patient.id,
                    patientInput.caseManagerIds,
                );
            }

            // Auto-create user if patient has email
            if (patientInput.email) {
                try {
                    const username = patientInput.email.split('@')[0];
                    const newUser = await this.userCrudService.createOne({
                        username: username,
                        email: patientInput.email,
                        firstName: patientInput.firstName,
                        lastName: patientInput.lastName,
                        password: this.generateRandomPassword(),
                    });

                    const patientRole = await Role.findOne({
                        code: RoleCode.PATIENT,
                    });
                    if (patientRole) {
                        newUser.roles = [patientRole];
                        await newUser.save();
                    }

                    await this.repo.update(patient.id, { userId: newUser.id });
                    patient.userId = newUser.id;
                } catch (error) {
                    console.error('Failed to create user for patient:', error);
                }
            }
        }

        return patients;
    }

    async getQuestionnaireReport(
        id: number,
        status?: string,
        questionnaireId?: string,
    ): Promise<PatientReport> {
        const patient = await this.repo
            .createQueryBuilder('patient')
            .leftJoinAndSelect('patient.assessments', 'assessment')
            .leftJoinAndSelect('assessment.assessmentType', 'assessmentType')
            .where('patient.id = :id', { id })
            .getOne();

        const answeredQuestionnaires = [];
        const answers = [];
        let questionnaireScripts = [];
        const assessmentResponse = [] as AssessmentResponse[];
        const questionnaireAssessment: QuestionnaireAssessment[] = []; //await Promise.all(queries);

        for (const assessment of patient.assessments) {
            const singleQuestionnaireAssessment = await this.questionnaireAssessmentService.getById(
                assessment.questionnaireAssessmentId,
            );

            const assessmentStatusFilter = status && singleQuestionnaireAssessment.status != status
            const questionnaireIdFilter = questionnaireId && !singleQuestionnaireAssessment.questionnaires.some(
                questionnaire => questionnaire._id == questionnaireId,
            )

            if (assessmentStatusFilter || questionnaireIdFilter) {
                continue;
            }

            if (singleQuestionnaireAssessment) {
                questionnaireAssessment.push(singleQuestionnaireAssessment);
            }

            assessmentResponse.push({
                ...assessment,
                status: singleQuestionnaireAssessment.status,
                assessmentId: assessment.questionnaireAssessmentId,
            } as AssessmentResponse);
        }

        if (!questionnaireAssessment.length) {
            throw new Exception("No record found!")
        }

        for (const assessment of questionnaireAssessment) {
            assessment.questionnaires.forEach(entry => {
                if (
                    (questionnaireId &&
                        questionnaireId == entry._id.toString()) ||
                    !questionnaireId
                ) {
                    answeredQuestionnaires.push({
                        ...entry,
                        assessmentId: assessment._id.toString(),
                        ...entry._doc,
                    });
                    answers.push(assessment.answers);
                }
            });
        }

        for (let i = 0; i < answeredQuestionnaires.length; i++) {
            const answeredQuestionnaire = answeredQuestionnaires[i];

            const questionnaireName = answeredQuestionnaire.abbreviation;
            const questionnaireLanguage = answeredQuestionnaire.language;

            const existingScript = questionnaireScripts.some(
                script =>
                    script.questionnaireId.toString() ===
                    answeredQuestionnaire?._doc._id.toString(),
            );

            if (!existingScript) {
                const questionnaireScriptsData: any = await this.questionnaireScriptService.getQuestionnaireScriptsById(
                    answeredQuestionnaire?._doc._id.toString(),
                );

                if (questionnaireScriptsData.length !== 0) {
                    questionnaireScriptsData.map(item => {
                        item.questionnaireName = questionnaireName;
                        item.questionnaireLanguage = questionnaireLanguage;
                    });

                    questionnaireScripts = [
                        ...questionnaireScripts,
                        ...questionnaireScriptsData,
                    ];
                }
            }

            answeredQuestionnaire.questionnaireFullName =
                answeredQuestionnaire?._doc?.name;
            answeredQuestionnaire.name =
                answeredQuestionnaire?._doc?.abbreviation;

            const answeredQuestionsMap = PatientQueryService.mapAnsweredQuestions(
                answers[i],
            );
            const questionGroups = answeredQuestionnaire._doc?.questionGroups?.flat();
            const questions = PatientQueryService.matchQuestionsToAnswers(
                questionGroups ?? [],
                answeredQuestionsMap,
            );
            answeredQuestionnaire.questions = questions;
        }

        return {
            patient,
            answeredQuestionnaires,
            questionnaireScripts,
            assessments: assessmentResponse,
        } as PatientReport;
    }

    private static mapAnsweredQuestions(answers: AnsweredQuestions[]) {
        const map = {} as IAnswerMap;
        for (const answer of answers) {
            answer.combinedDate = null;
            map[answer.question.toString()] = { ...answer['_doc'] };
            map[answer.question.toString()][
                'questionId'
            ] = answer.question.toString();
            if (answer.dateValue && answer.textValue) {
                const [hours, minutes] = answer.textValue.split(':');
                map[answer.question.toString()]['combinedDate'] = new Date(
                    answer.dateValue.setUTCHours(+hours, +minutes, 0, 0),
                );
            }
        }
        return map;
    }

    private static matchQuestionsToAnswers(
        questionGroups: IQuestionGroup[],
        answeredQuestionsMap: IAnswerMap,
    ) {
        let results = [];

        for (const questionGroup of questionGroups) {
            const questions = questionGroup.questions.map(question => {
                const { type, name, label, required, choices, hint } = question;
                return {
                    type,
                    variable: name,
                    label,
                    required,
                    choices,
                    hint,
                    questionGrouplabel: questionGroup.label,
                    answer: answeredQuestionsMap[question._id.toString()],
                };
            });

            results = results.concat(questions);
        }
        return results;
    }
}
