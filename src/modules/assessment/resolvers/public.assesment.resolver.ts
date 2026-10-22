import { BadRequestException } from '@nestjs/common';
import * as CryptoJS from 'crypto-js';
import { configService } from 'src/config/config.service';
import { Resolver, Query, Args } from '@nestjs/graphql';
import { Assessment, FullPublicAssessment } from '../models/assessment.model';
import { AssessmentService } from '../services/assessment.service';

@Resolver(() => Assessment)
export class PublicAssessmentResolver {
    constructor(
        private readonly assessmentService: AssessmentService,
    ) { }
    @Query(() => String)
    resolvePublicAssessmentLink(@Args('token') token: string): string {
        try {
            const uuid = CryptoJS.AES.decrypt(token, configService.getFrontendEncryptionKey()).toString(CryptoJS.enc.Utf8);
            if (!/^[a-f0-9-]{36}$/i.test(uuid)) throw new Error('Invalid link');
            return uuid;
        } catch {
            throw new BadRequestException('Assessment link is invalid or no longer available.');
        }
    }

    @Query(() => FullPublicAssessment)
    getFullPublicAssessment(
        @Args('uuid', { type: () => String }) uuid: string,
    ): Promise<FullPublicAssessment> {
        return this.assessmentService.getFullPublicAssessment(uuid);
    }

}