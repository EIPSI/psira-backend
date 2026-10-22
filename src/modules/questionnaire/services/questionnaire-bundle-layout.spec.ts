jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
import { QuestionnaireBundleService } from './questionnaire-bundle.service';

describe('Questionnaire bundle minimum structure', () => {
    const service = Object.create(QuestionnaireBundleService.prototype);
    const page = { id: 'page', type: 'SCREEN', children: [] };
    const questionnaire = { id: 'q', type: 'QUESTIONNAIRE', questionnaireId: 'example' };
    it('accepts a first page followed by a fixed or randomized group', () => {
        for (const type of ['FIXED_GROUP', 'RANDOM_GROUP']) {
            expect(() => service.validateStructureLayout([page, { id: 'group', type, children: [questionnaire] }])).not.toThrow();
        }
    });
    it('adapts legacy bundles when duplicated without losing content or first-page text', () => {
        const legacy = [{ id: 'old', type: 'RANDOM_GROUP', headerHtml: '<p>Header</p>', children: [questionnaire] }];
        const result = service.structureFromInput({ structureJson: JSON.stringify(legacy) });
        expect(result[0].type).toBe('SCREEN');
        expect(result[0].headerHtml).toBe('<p>Header</p>');
        expect(result[1].type).toBe('RANDOM_GROUP');
        expect(result[1].children[0].questionnaireId).toBe('example');
    });
    it('rejects deletion of either mandatory structural element', () => {
        expect(() => service.validateStructureLayout([page])).toThrow();
        expect(() => service.validateStructureLayout([{ type: 'FIXED_GROUP', children: [questionnaire] }])).toThrow();
    });
    it('rejects questionnaires outside a group and children inside a page', () => {
        expect(() => service.validateStructureLayout([page, { type: 'FIXED_GROUP' }, questionnaire])).toThrow();
        expect(() => service.validateStructureLayout([{ ...page, children: [questionnaire] }, { type: 'FIXED_GROUP' }])).toThrow();
    });
});
