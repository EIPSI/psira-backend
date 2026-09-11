import { Args, Context, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PendingInformedConsentDto } from '../dtos/pending-informed-consent.dto';
import {
    CancelInformedConsentReactivationInput,
    SubmitInformedConsentResponseInput,
} from '../dtos/informed-consent-response.input';
import { InformedConsentModel } from '../models/informed-consent-model.model';
import { InformedConsentResponse } from '../models/informed-consent-response.model';
import { InformedConsentResponseService } from '../services/informed-consent-response.service';

@Resolver()
export class InformedConsentPublicResolver {
    constructor(private readonly responseService: InformedConsentResponseService) {}

    @Query(() => [PendingInformedConsentDto])
    publicPendingInformedConsents(
        @Args('token') token: string,
    ): Promise<PendingInformedConsentDto[]> {
        return this.responseService.pendingForPublicToken(token);
    }

    @Query(() => InformedConsentModel)
    publicPendingInformedConsentModel(
        @Args('token') token: string,
        @Args('id', { type: () => Int }) id: number,
    ): Promise<InformedConsentModel> {
        return this.responseService.getPendingModelForPublicToken(token, id);
    }

    @Mutation(() => InformedConsentResponse)
    submitPublicInformedConsentResponse(
        @Args('token') token: string,
        @Args('input') input: SubmitInformedConsentResponseInput,
        @Context() context: any,
    ): Promise<InformedConsentResponse> {
        return this.responseService.submitPublic(token, input, context?.req);
    }

    @Mutation(() => InformedConsentResponse)
    cancelPublicInformedConsentReactivation(
        @Args('token') token: string,
        @Args('input') input: CancelInformedConsentReactivationInput,
    ): Promise<InformedConsentResponse> {
        return this.responseService.cancelReactivationPublic(token, input);
    }
}
