import { ForbiddenException } from '@nestjs/common';
import { getNamedType, GraphQLNamedType } from 'graphql';
import { getRepository } from 'typeorm';
import * as mongoose from 'mongoose';
import { User } from 'src/modules/user/models/user.model';
import { isSuperAdministrator } from './administrative-access';

const resourceModels = new Set(['EvaluationScheme', 'RandomizationRule', 'EvaluationAutomation', 'InformedConsentModel',
    'InformedConsentManagement', 'NotificationConfiguration', 'MailTemplate', 'Report', 'Questionnaire', 'QuestionnaireBundle', 'Role', 'PatientStatus', 'AssessmentType', 'CaseEventReason', 'CaseEventReasonTree']);

export const resourceDepartmentIds = (resource: any): number[] =>
    (resource.departmentIds || (resource.departmentId ? [resource.departmentId] : resource.departments?.map(department => department.id)) || []).map(Number);

export async function projectDepartments(userId: number): Promise<number[] | null> {
    const viewer = await User.findOneOrFail(userId, { relations: ['roles', 'departments'] });
    if (isSuperAdministrator(viewer) || viewer.roles.some(role => role.code === 'RESEARCH_ADMIN') ||
        !viewer.roles.some(role => role.code === 'PROJECT_RESEARCHER' || role.departmentIds?.length)) return null;
    return viewer.departments.map(department => department.id);
}

export function assertProjectResourceDepartments(owned: number[], resource: any, writing: boolean): void {
    const departments = resourceDepartmentIds(resource);
    if (writing ? !departments.length || departments.some(id => !owned.includes(id))
        : departments.length && !departments.some(id => owned.includes(id))) {
        throw new ForbiddenException('Shared or external resources require a global administrator; create a project copy instead');
    }
    if (writing && resource.appliesToAllDepartments) throw new ForbiddenException('Project configuration cannot apply to every department');
}

async function loadResource(model: string, id: number | string): Promise<any> {
    if (['Questionnaire', 'QuestionnaireBundle'].includes(model)) {
        return mongoose.model(model).findById(id).lean().exec();
    }
    const repo = getRepository(model);
    return repo.findOne(id, { relations: repo.metadata.relations.some(relation => relation.propertyName === 'departments') ? ['departments'] : [] });
}

export async function assertProjectResourceRequest(userId: number, info: any, args: any): Promise<void> {
    let model = (getNamedType(info.returnType) as GraphQLNamedType).name.replace(/Connection$|DeleteResponse$/, '');
    const operation = info.fieldName as string;
    if (['getReportEmbed', 'startReportSession'].includes(operation) && args.patientId) {
        const departments = await projectDepartments(userId);
        if (departments) {
            const patient = await getRepository('Patient').findOne(args.patientId, { relations: ['departments'] });
            if (!patient || !resourceDepartmentIds(patient).some(id => departments.includes(id))) throw new ForbiddenException('Patient not found in your departments');
            assertProjectResourceDepartments(departments, patient, false);
        }
    }
    if (/EmailTemplate$/.test(operation)) model = 'MailTemplate';
    for (const name of ['SchemeResourceTemplate', 'SchemeSessionTemplate', 'EvaluationScheme', 'EvaluationAutomation',
        'Role', 'PatientStatus', 'AssessmentType', 'CaseEventReasonTree', 'CaseEventReason', 'RandomizationRuleItem', 'RandomizationRule', 'InformedConsentManagement', 'InformedConsentModel', 'QuestionnaireBundle', 'QuestionnaireScript', 'Questionnaire']) {
        if (operation.endsWith(name)) { model = name; break; }
    }
    if (/PatientStatuses$/.test(operation)) model = 'PatientStatus';
    if (args.versionId) model = 'InformedConsentVersion';
    const derived = ['SchemeSessionTemplate', 'SchemeResourceTemplate', 'InformedConsentVersion', 'QuestionnaireScript', 'RandomizationRuleItem'].includes(model);
    if (!resourceModels.has(model) && !derived) return;
    const writing = info.operation.operation === 'mutation';
    const envelope = args.input || args.xlsForm || args.scheme || args.bundle || args.sessionTemplate || args.resourceTemplate || args.assessmentType || args.reason || args.tree || args;
    const input = envelope.mailTemplate || envelope.emailTemplate || envelope.report || envelope.questionnaire || envelope.model || envelope.role || envelope.patientStatus || envelope;
    let id = envelope.id || input.id || input._id || input.assessmentTypeId || args.id || args._id || args.versionId || (model === 'Questionnaire' ? input.questionnaireId : undefined);
    if (!writing && !id) return; // List resolvers apply their own department filter.
    const owned = await projectDepartments(userId);
    if (!owned) return;
    if (writing && /^(updateMany|deleteMany)/.test(operation)) {
        throw new ForbiddenException('Update project definitions individually to preserve department ownership');
    }
    if (writing && !id && ['Role', 'PatientStatus', 'AssessmentType'].includes(model) && input.departmentIds === undefined) {
        input.departmentIds = [...owned];
    }
    if (derived) {
        const row = id ? await loadResource(model, id) : input;
        if (model === 'RandomizationRuleItem') { id = row?.randomizationRuleId || input.randomizationRuleId; model = 'RandomizationRule'; }
        else if (model === 'QuestionnaireScript') { id = row?.questionnaireId || input.questionnaireId; model = 'Questionnaire'; }
        else if (model === 'InformedConsentVersion') { id = row?.modelId || input.modelId; model = 'InformedConsentModel'; }
        else {
            id = row?.schemeId || input.schemeId;
            if (!id && (row?.sessionTemplateId || input.sessionTemplateId)) {
                id = (await loadResource('SchemeSessionTemplate', row?.sessionTemplateId || input.sessionTemplateId))?.schemeId;
            }
            model = 'EvaluationScheme';
        }
    }
    if (id) {
        const existing = await loadResource(model, id);
        if (!existing) throw new ForbiddenException('Resource not found');
        assertProjectResourceDepartments(owned, existing, writing);
        const changes = input.update || input;
        if (writing && model === 'Role' && changes.departmentIds !== undefined &&
            JSON.stringify([...changes.departmentIds].map(Number).sort()) !== JSON.stringify(resourceDepartmentIds(existing).sort())) {
            throw new ForbiddenException('Create a separate role to change its departmental scope');
        }
        if (writing && (changes.departmentIds !== undefined || changes.departmentId !== undefined || changes.appliesToAllDepartments)) {
            assertProjectResourceDepartments(owned, { ...existing, ...changes }, true);
        }
    } else if (writing) assertProjectResourceDepartments(owned, input, true);
}

export async function filterProjectResources<T>(userId: number, rows: T[]): Promise<T[]> {
    const owned = await projectDepartments(userId);
    if (!owned) return rows;
    return rows.filter(row => {
        const departments = resourceDepartmentIds(row);
        return !departments.length || departments.some(id => owned.includes(id));
    });
}
