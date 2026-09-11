import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Department } from 'src/modules/department/models/department.model';
import { User } from 'src/modules/user/models/user.model';
import { Repository } from 'typeorm';
import {
    CreateInformedConsentModelInput,
    CreateInformedConsentVersionInput,
    UpdateInformedConsentModelInput,
} from '../dtos/informed-consent-model.input';
import { InformedConsentShortcutDto } from '../dtos/informed-consent-shortcut.dto';
import { InformedConsentQuestionType } from '../enums/informed-consent-question-type.enum';
import { InformedConsentKind } from '../enums/informed-consent-kind.enum';
import { InformedConsentVersionStatus } from '../enums/informed-consent-version-status.enum';
import { InformedConsentAnswerOption } from '../models/informed-consent-answer-option.model';
import { InformedConsentModel } from '../models/informed-consent-model.model';
import { InformedConsentQuestion } from '../models/informed-consent-question.model';
import { InformedConsentTextBlock } from '../models/informed-consent-text-block.model';
import { InformedConsentVersion } from '../models/informed-consent-version.model';

@Injectable()
export class InformedConsentModelService {
    constructor(
        @InjectRepository(InformedConsentModel)
        private readonly modelRepository: Repository<InformedConsentModel>,
        @InjectRepository(InformedConsentVersion)
        private readonly versionRepository: Repository<InformedConsentVersion>,
        @InjectRepository(InformedConsentTextBlock)
        private readonly textBlockRepository: Repository<InformedConsentTextBlock>,
        @InjectRepository(InformedConsentQuestion)
        private readonly questionRepository: Repository<InformedConsentQuestion>,
        @InjectRepository(InformedConsentAnswerOption)
        private readonly answerOptionRepository: Repository<InformedConsentAnswerOption>,
        @InjectRepository(Department)
        private readonly departmentRepository: Repository<Department>,
    ) {}

    list(): Promise<InformedConsentModel[]> {
        return this.modelRepository.find({
            relations: ['departments', 'currentPublishedVersion'],
            order: { id: 'DESC' },
        });
    }

    async get(id: number): Promise<InformedConsentModel> {
        const model = await this.modelRepository.findOne(id, {
            relations: [
                'departments',
                'currentPublishedVersion',
                'currentPublishedVersion.textBlocks',
                'currentPublishedVersion.questions',
                'currentPublishedVersion.questions.answerOptions',
                'versions',
                'versions.textBlocks',
                'versions.questions',
                'versions.questions.answerOptions',
            ],
        });
        if (!model) throw new NotFoundException('Informed consent model not found.');
        return model;
    }

    async create(
        input: CreateInformedConsentModelInput,
        currentUser: User,
    ): Promise<InformedConsentModel> {
        this.assertVersionContent(input.textBlocks);
        const model = this.modelRepository.create({
            name: input.name,
            kind: input.kind,
            description: input.description,
            active: input.active ?? true,
            systemDefault: input.systemDefault ?? false,
            createdById: currentUser?.id,
        });
        model.departments = await this.resolveDepartments(input.departmentIds);
        const savedModel = await this.modelRepository.save(model);
        const version = await this.createVersionForModel(savedModel.id, {
            modelId: savedModel.id,
            title: input.versionTitle,
            notes: input.versionNotes,
            submitButtonLabel: input.submitButtonLabel,
            thankYouHtml: input.thankYouHtml,
            textBlocks: input.textBlocks,
            questions: input.questions,
        }, currentUser, true);
        savedModel.currentPublishedVersionId = version.id;
        await this.modelRepository.save(savedModel);
        return this.get(savedModel.id);
    }

    async update(input: UpdateInformedConsentModelInput): Promise<InformedConsentModel> {
        const model = await this.get(input.id);
        if (input.name !== undefined) model.name = input.name;
        if (input.kind !== undefined) model.kind = input.kind;
        if (input.description !== undefined) model.description = input.description;
        if (input.active !== undefined) model.active = input.active;
        if (input.systemDefault !== undefined) model.systemDefault = input.systemDefault;
        if (input.departmentIds !== undefined) {
            model.departments = await this.resolveDepartments(input.departmentIds);
        }
        await this.modelRepository.save(model);
        if (input.textBlocks?.length) {
            const version = await this.createVersionForModel(model.id, {
                modelId: model.id,
                title: input.versionTitle || `${model.name} nueva versión`,
                notes: input.versionNotes,
                submitButtonLabel: input.submitButtonLabel,
                thankYouHtml: input.thankYouHtml,
                textBlocks: input.textBlocks,
                questions: input.questions,
            }, undefined, true);
            model.currentPublishedVersionId = version.id;
            await this.modelRepository.save(model);
        }
        return this.get(model.id);
    }

    shortcuts(): InformedConsentShortcutDto[] {
        return [
            { group: 'Usuario', label: 'Nombre', token: '{{user.firstName}}', description: 'Nombre del usuario que debe responder.' },
            { group: 'Usuario', label: 'Nombre completo', token: '{{user.fullName}}', description: 'Nombre completo del usuario que debe responder.' },
            { group: 'Usuario', label: 'Email', token: '{{user.email}}', description: 'Email del usuario que debe responder.' },
            { group: 'Usuario', label: 'Rol', token: '{{user.role}}', description: 'Rol principal o rol destinatario del usuario.' },
            { group: 'Caso', label: 'Paciente', token: '{{patient.fullName}}', description: 'Nombre completo del paciente cuando el consentimiento aplica a un caso.' },
            { group: 'Caso', label: 'Historia clínica', token: '{{patient.medicalRecordNo}}', description: 'Número de historia clínica del paciente.' },
            { group: 'Caso', label: 'Administrador del caso', token: '{{caseManager.fullName}}', description: 'Administrador responsable del caso.' },
            { group: 'Supervisión', label: 'Terapeuta', token: '{{therapist.fullName}}', description: 'Terapeuta vinculado a una supervisión.' },
            { group: 'Supervisión', label: 'Supervisor', token: '{{supervisor.fullName}}', description: 'Supervisor vinculado a una supervisión.' },
            { group: 'Institución', label: 'Departamento', token: '{{department.name}}', description: 'Departamento que solicita el consentimiento, si aplica.' },
            { group: 'Consentimiento', label: 'Modelo', token: '{{consent.modelName}}', description: 'Nombre del modelo de consentimiento informado.' },
            { group: 'Consentimiento', label: 'Versión', token: '{{consent.version}}', description: 'Número o título de versión vigente.' },
            { group: 'Consentimiento', label: 'Fecha', token: '{{consent.date}}', description: 'Fecha de presentación o firma.' },
            { group: 'Consentimiento', label: 'Link de respuesta', token: '{{consent.link}}', description: 'Acceso directo para responder consentimientos pendientes.' },
        ];
    }

    createVersion(
        input: CreateInformedConsentVersionInput,
        currentUser: User,
    ): Promise<InformedConsentVersion> {
        return this.createVersionForModel(input.modelId, input, currentUser, false);
    }

    async publishVersion(versionId: number): Promise<InformedConsentModel> {
        const version = await this.versionRepository.findOne(versionId);
        if (!version) throw new NotFoundException('Informed consent version not found.');
        await this.versionRepository.update(
            { modelId: version.modelId, status: InformedConsentVersionStatus.PUBLISHED },
            { status: InformedConsentVersionStatus.ARCHIVED },
        );
        version.status = InformedConsentVersionStatus.PUBLISHED;
        version.publishedAt = new Date();
        await this.versionRepository.save(version);
        await this.modelRepository.update(version.modelId, { currentPublishedVersionId: version.id });
        return this.get(version.modelId);
    }

    async delete(id: number): Promise<boolean> {
        const result = await this.modelRepository.delete(id);
        return !!result.affected;
    }

    async duplicate(id: number, currentUser: User): Promise<InformedConsentModel> {
        const source = await this.get(id);
        const sourceVersion = source.currentPublishedVersion || source.versions?.[0];
        if (!sourceVersion) throw new BadRequestException('Informed consent model has no version to duplicate.');
        return this.create({
            name: `${source.name} copia`,
            kind: source.kind,
            description: source.description,
            active: source.active,
            systemDefault: false,
            departmentIds: source.departments?.map(department => department.id) || [],
            versionTitle: sourceVersion.title,
            versionNotes: sourceVersion.notes,
            submitButtonLabel: sourceVersion.submitButtonLabel,
            thankYouHtml: sourceVersion.thankYouHtml,
            textBlocks: (sourceVersion.textBlocks || []).map(block => ({
                orderIndex: block.orderIndex,
                title: block.title,
                content: block.content,
            })),
            questions: (sourceVersion.questions || []).map(question => ({
                kind: question.kind,
                kinds: question.kinds?.length ? question.kinds : [question.kind],
                questionType: question.questionType,
                orderIndex: question.orderIndex,
                label: question.label,
                helpText: question.helpText,
                required: question.required,
                answerOptions: (question.answerOptions || []).map(option => ({
                    orderIndex: option.orderIndex,
                    value: option.value,
                    label: option.label,
                    resolution: option.resolution,
                    blocksUsageOnSelection: option.blocksUsageOnSelection,
                })),
            })),
        }, currentUser);
    }

    private async createVersionForModel(
        modelId: number,
        input: CreateInformedConsentVersionInput,
        currentUser: User | undefined,
        publish: boolean,
    ): Promise<InformedConsentVersion> {
        this.assertVersionContent(input.textBlocks);
        this.assertQuestions(input.questions);
        const model = await this.modelRepository.findOne(modelId);
        if (!model) throw new NotFoundException('Informed consent model not found.');
        const maxVersion = await this.versionRepository
            .createQueryBuilder('version')
            .where('version.modelId = :modelId', { modelId })
            .select('MAX(version.versionNumber)', 'max')
            .getRawOne();
        const versionNumber = Number(maxVersion?.max ?? 0) + 1;
        const version = await this.versionRepository.save(this.versionRepository.create({
            modelId,
            versionNumber,
            title: input.title,
            notes: input.notes,
            submitButtonLabel: input.submitButtonLabel || 'Registrar respuesta',
            thankYouHtml: input.thankYouHtml || '<p>Gracias. Tu respuesta fue registrada correctamente.</p>',
            status: publish ? InformedConsentVersionStatus.PUBLISHED : InformedConsentVersionStatus.DRAFT,
            publishedAt: publish ? new Date() : undefined,
            createdById: currentUser?.id,
        }));
        await this.saveVersionContent(version.id, input);
        return this.versionRepository.findOne(version.id, {
            relations: ['textBlocks', 'questions', 'questions.answerOptions'],
        });
    }

    private async saveVersionContent(
        versionId: number,
        input: Pick<CreateInformedConsentVersionInput, 'textBlocks' | 'questions'>,
    ): Promise<void> {
        for (const block of input.textBlocks) {
            await this.textBlockRepository.save(this.textBlockRepository.create({
                versionId,
                orderIndex: block.orderIndex,
                title: block.title,
                content: block.content,
            }));
        }
        for (const questionInput of input.questions ?? []) {
            const question = await this.questionRepository.save(this.questionRepository.create({
                versionId,
                kind: questionInput.kind || questionInput.kinds?.[0] || InformedConsentKind.TERMS_OF_USE,
                kinds: questionInput.kinds?.length
                    ? questionInput.kinds
                    : [questionInput.kind || InformedConsentKind.TERMS_OF_USE],
                questionType: questionInput.questionType,
                orderIndex: questionInput.orderIndex,
                label: questionInput.label,
                helpText: questionInput.helpText,
                required: questionInput.required ?? true,
            }));
            for (const option of questionInput.answerOptions ?? []) {
                await this.answerOptionRepository.save(this.answerOptionRepository.create({
                    questionId: question.id,
                    orderIndex: option.orderIndex,
                    value: option.value || this.optionValue(option.label, option.orderIndex),
                    label: option.label,
                    resolution: option.resolution,
                    blocksUsageOnSelection: option.blocksUsageOnSelection ?? false,
                }));
            }
        }
    }

    private assertVersionContent(textBlocks?: { content: string }[]): void {
        if (!textBlocks?.length) {
            throw new BadRequestException('At least one text block is required.');
        }
        if (textBlocks.some(block => !block.content?.trim())) {
            throw new BadRequestException('Text blocks cannot be empty.');
        }
    }

    private assertQuestions(questions?: CreateInformedConsentVersionInput['questions']): void {
        for (const question of questions ?? []) {
            if (!question.label?.trim()) {
                throw new BadRequestException('Question label is required.');
            }
            const requiresOptions = [
                InformedConsentQuestionType.CHECKBOX,
                InformedConsentQuestionType.SINGLE_CHOICE,
                InformedConsentQuestionType.MULTIPLE_CHOICE,
            ].includes(question.questionType);
            if (requiresOptions && !question.answerOptions?.length) {
                throw new BadRequestException('Choice questions require at least one answer option.');
            }
            if ((question.answerOptions ?? []).some(option => !option.label?.trim())) {
                throw new BadRequestException('Answer options require label.');
            }
        }
    }

    private optionValue(label: string, orderIndex: number): string {
        return (label || `option-${orderIndex}`)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || `option-${orderIndex}`;
    }

    private async resolveDepartments(departmentIds?: number[]): Promise<Department[]> {
        if (!departmentIds?.length) return [];
        return this.departmentRepository.findByIds(departmentIds);
    }
}
