import { ExecutionContext, Injectable, Logger, Optional } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { AuthenticationError } from 'apollo-server-express';
import { ForbiddenError } from 'apollo-server-express';
import { Reflector } from '@nestjs/core';
import { InformedConsentAccessService } from '../informed-consent/services/informed-consent-access.service';

@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    @Optional()
    private readonly informedConsentAccessService?: InformedConsentAccessService,
  ) {
    super();
  }

  protected readonly logger = new Logger(GqlAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const { req } = ctx.getContext();

    const activation = super.canActivate(
      new ExecutionContextHost([req]),
    );
    const activated = await this.resolveActivation(activation);
    const fieldName = ctx.getInfo()?.fieldName;
    const userId = req?.user?.id;
    if (
      activated
      && userId
      && this.informedConsentAccessService
      && await this.informedConsentAccessService.shouldBlockOperation(userId, fieldName)
    ) {
      throw new ForbiddenError('Pending mandatory informed consent must be completed before using PSIRA.');
    }
    return activated;
  }

  private resolveActivation(activation: any): Promise<boolean> {
    if (activation && typeof activation.toPromise === 'function') {
      return activation.toPromise();
    }
    return Promise.resolve(activation);
  }

  handleRequest(err: any, user: any) {

    if (err) {
      this.logger.error(`Auth Error! ${err.message}`);
      throw err;
    }

    if (!user) {
      this.logger.error('Auth Error! User not found');
      throw new AuthenticationError('Auth Error! User not found');
    }

    if (!user.active) {
      this.logger.error('Auth Error! User de-activated');
      throw new AuthenticationError('Auth Error! User de-activated, please contact your administrator.');
    }

    return user;
  }
}
