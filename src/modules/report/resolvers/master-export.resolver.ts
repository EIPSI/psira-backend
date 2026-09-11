import { Args, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import { CurrentUser } from 'src/modules/auth/auth-user.decorator';
import { UseOrPermissions } from 'src/modules/permission/decorators/permission.decorator';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { User } from 'src/modules/user/models/user.model';
import { MasterExportDataset } from '../models/master-export-dataset.model';
import { MasterExportService } from '../services/master-export.service';

@Resolver(() => MasterExportDataset)
@UseGuards(GqlAuthGuard)
export class MasterExportResolver {
    constructor(private readonly masterExportService: MasterExportService) {}

    @Query(() => [MasterExportDataset])
    @UseOrPermissions([
        PermissionEnum.REPORTS_VIEW_ASSIGNED,
        PermissionEnum.REPORTS_VIEW_DEPARTMENT,
        PermissionEnum.REPORTS_VIEW_ALL,
    ])
    async masterExportDatasets(
        @CurrentUser() currentUser: User,
        @Args('includeUnavailable', { type: () => Boolean, nullable: true })
        includeUnavailable?: boolean,
    ): Promise<MasterExportDataset[]> {
        return this.masterExportService.getDatasets(
            currentUser,
            !!includeUnavailable,
        );
    }

    @Query(() => MasterExportDataset, { nullable: true })
    @UseOrPermissions([
        PermissionEnum.REPORTS_VIEW_ASSIGNED,
        PermissionEnum.REPORTS_VIEW_DEPARTMENT,
        PermissionEnum.REPORTS_VIEW_ALL,
    ])
    async masterExportDataset(
        @CurrentUser() currentUser: User,
        @Args('key', { type: () => String }) key: string,
    ): Promise<MasterExportDataset> {
        const dataset = await this.masterExportService.getDataset(currentUser, key);
        return dataset?.available ? dataset : null;
    }
}
