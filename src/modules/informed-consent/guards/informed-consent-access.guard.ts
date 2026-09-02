import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ForbiddenError } from 'apollo-server-express';
import { InformedConsentAccessService } from '../services/informed-consent-access.service';

@Injectable()
export class InformedConsentAccessGuard implements CanActivate {
    constructor(
        private readonly accessService: InformedConsentAccessService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const gqlContext = GqlExecutionContext.create(context);
        const userId = gqlContext.getContext()?.req?.user?.id;
        if (!userId) return true;
        const fieldName = gqlContext.getInfo()?.fieldName;
        if (await this.accessService.shouldBlockOperation(userId, fieldName)) {
            throw new ForbiddenError('Pending mandatory informed consent must be completed before using PSIRA.');
        }
        return true;
    }
}
