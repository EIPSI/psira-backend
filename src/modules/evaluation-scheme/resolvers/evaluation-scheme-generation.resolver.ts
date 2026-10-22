import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { CurrentUser } from 'src/modules/auth/auth-user.decorator';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import { CalendarOccurrence } from 'src/modules/calendar/models/calendar-occurrence.model';
import { UseOrPermissions } from 'src/modules/permission/decorators/permission.decorator';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { PermissionGuard } from 'src/modules/permission/guards/permission.guard';
import { User } from 'src/modules/user/models/user.model';
import {
    ApplyEvaluationSchemeInput,
    GenerateSchemeOccurrencesInput,
    RegenerateFutureSchemeOccurrencesInput,
} from '../dtos/evaluation-scheme-generation.input';
import { EvaluationSchemeAssignment } from '../models/evaluation-scheme-assignment.model';
import { SchemeGenerationService } from '../services/scheme-generation.service';

@Resolver(() => EvaluationSchemeAssignment)
@UseGuards(GqlAuthGuard, PermissionGuard)
export class EvaluationSchemeGenerationResolver {
    constructor(private readonly schemeGenerationService: SchemeGenerationService) {}

    @Mutation(() => EvaluationSchemeAssignment)
    @UseOrPermissions([PermissionEnum.EVALUATION_SCHEMES_EDIT_DEPARTMENT, PermissionEnum.ASSESSMENTS_CREATE_ALL,
        PermissionEnum.ASSESSMENTS_CREATE_DEPARTMENT, PermissionEnum.ASSESSMENTS_CREATE_ASSIGNED])
    applyEvaluationScheme(
        @Args('assignment') input: ApplyEvaluationSchemeInput,
        @CurrentUser() currentUser: User,
    ): Promise<EvaluationSchemeAssignment> {
        return this.schemeGenerationService.applyScheme(input, currentUser);
    }

    @Mutation(() => [CalendarOccurrence])
    @UseOrPermissions([PermissionEnum.EVALUATION_SCHEMES_EDIT_DEPARTMENT, PermissionEnum.ASSESSMENTS_CREATE_ALL,
        PermissionEnum.ASSESSMENTS_CREATE_DEPARTMENT, PermissionEnum.ASSESSMENTS_CREATE_ASSIGNED])
    generateSchemeOccurrences(
        @Args('generation') input: GenerateSchemeOccurrencesInput,
        @CurrentUser() currentUser: User,
    ): Promise<CalendarOccurrence[]> {
        return this.schemeGenerationService.generateOccurrences(input, currentUser);
    }

    @Mutation(() => [CalendarOccurrence])
    @UseOrPermissions([PermissionEnum.EVALUATION_SCHEMES_EDIT_DEPARTMENT, PermissionEnum.ASSESSMENTS_CREATE_ALL,
        PermissionEnum.ASSESSMENTS_CREATE_DEPARTMENT, PermissionEnum.ASSESSMENTS_CREATE_ASSIGNED])
    regenerateFutureSchemeOccurrences(
        @Args('generation') input: RegenerateFutureSchemeOccurrencesInput,
        @CurrentUser() currentUser: User,
    ): Promise<CalendarOccurrence[]> {
        return this.schemeGenerationService.regenerateFutureOccurrences(
            input,
            currentUser,
        );
    }
}
