import { CurrentUser } from 'src/modules/auth/auth-user.decorator';
import { User } from 'src/modules/user/models/user.model';
import { PermissionService } from 'src/modules/permission/providers/permission.service';
import { ForbiddenException } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import { UseOrPermissions } from 'src/modules/permission/decorators/permission.decorator';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { PermissionGuard } from 'src/modules/permission/guards/permission.guard';
import { UpdateDisclaimerInput } from '../dtos/disclaimer.dto';
import { Disclaimer } from '../models/disclaimer.model';
import { DisclaimerService } from '../providers/disclaimer.service';

@Resolver(() => Disclaimer)
export class DisclaimerResolver {
    constructor(private readonly disclaimerService: DisclaimerService) {}

    @Query(() => [Disclaimer])
    async disclaimers(): Promise<Disclaimer[]> {
        return this.disclaimerService.getDisclaimers();
    }

    @Query(() => [Disclaimer])
    @UseGuards(GqlAuthGuard)
    async departmentDisclaimers(
        @CurrentUser() user: User,
        @Args('departmentId', { type: () => Int, nullable: true }) departmentId?: number,
    ): Promise<Disclaimer[]> {
        const viewer = await User.findOneOrFail(user.id, { relations: ['departments'] });
        const selected = departmentId === undefined ? viewer.departments[0]?.id : departmentId;
        await this.assertScope(user.id, selected);
        return this.disclaimerService.getDisclaimers(selected);
    }

    private async assertScope(userId: number, departmentId?: number, writing = false): Promise<void> {
        if (await PermissionService.userCan(userId, writing ? PermissionEnum.SETTINGS_EDIT_ALL : PermissionEnum.SETTINGS_VIEW_ALL)) return;
        const viewer = await User.findOneOrFail(userId, { relations: ['departments'] });
        if (!departmentId && !writing) return;
        if (!departmentId || !viewer.departments.some(department => department.id === departmentId)) {
            throw new ForbiddenException('Department outside your scope');
        }
    }

    @Mutation(() => Disclaimer)
    @UseGuards(GqlAuthGuard, PermissionGuard)
    @UseOrPermissions([PermissionEnum.SETTINGS_EDIT_ALL, PermissionEnum.SETTINGS_EDIT_DEPARTMENT])
    async updateDisclaimer(
        @Args('input') input: UpdateDisclaimerInput,
        @CurrentUser() user: User,
    ): Promise<Disclaimer> {
        await this.assertScope(user.id, input.departmentId, true);
        return this.disclaimerService.updateDisclaimer(input);
    }
}
