import { Answer } from '../models/answer.schema';
import { BasicValidator } from './basic.validation';
import { UserInputError } from 'apollo-server-express';

export class NumberQuestionValidator extends BasicValidator {
    protected validate(answer: Answer): void {
        const range = this.question.presentation;
        if (range && this.question.required && answer.numberValue == null) {
            throw new UserInputError(this.question.requiredMessage || 'A numeric answer is required');
        }
        if (range && answer.numberValue != null) {
            const value = answer.numberValue;
            if (!Number.isFinite(value) || value < range.min || value > range.max ||
                (this.question.type === 'integer' && !Number.isInteger(value))) {
                throw new UserInputError(`Answer must be between ${range.min} and ${range.max}`);
            }
            if (range.step && Math.abs((value - range.min) / range.step - Math.round((value - range.min) / range.step)) > 0.000001) {
                throw new UserInputError(`Answer must follow step ${range.step}`);
            }
        }
        if (this.question.required && answer.numberValue === null) throw new UserInputError('Answer cannot be empty');
        if (!range && this.question.max && answer.numberValue > this.question.max) {
            throw new UserInputError(
                `Number given for question ${this.question.name} is too high. Can only be ${this.question.max} or below.`,
            );
        }
    }
}
