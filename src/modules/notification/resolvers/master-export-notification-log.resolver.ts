import { UseGuards } from '@nestjs/common';
import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from 'src/modules/auth/auth-user.decorator';
import { GqlAuthGuard } from 'src/modules/auth/auth.guard';
import { UseOrPermissions } from 'src/modules/permission/decorators/permission.decorator';
import { PermissionEnum } from 'src/modules/permission/enums/permission.enum';
import { PermissionGuard } from 'src/modules/permission/guards/permission.guard';
import { PermissionService } from 'src/modules/permission/providers/permission.service';
import { User } from 'src/modules/user/models/user.model';
import { NotificationLog } from '../models/notification-log.model';

@Resolver(() => NotificationLog)
@UseGuards(GqlAuthGuard, PermissionGuard)
export class MasterExportNotificationLogResolver {
    @Query(() => [NotificationLog])
    @UseOrPermissions([
        PermissionEnum.NOTIFICATION_LOGS_VIEW_ALL,
        PermissionEnum.NOTIFICATION_LOGS_VIEW_DEPARTMENT,
    ])
    async masterExportNotificationLogs(
        @CurrentUser() currentUser: User,
        @Args('afterId', { type: () => Int, defaultValue: 0 }) afterId: number,
        @Args('limit', { type: () => Int, defaultValue: 500 }) limit: number,
    ): Promise<NotificationLog[]> {
        const grants = await PermissionService.userPermissionGrants(currentUser.id);
        const query = NotificationLog.createQueryBuilder('log')
            .where('log.id > :afterId', { afterId: Math.max(0, afterId) })
            .orderBy('log.id', 'ASC')
            .take(Math.min(500, Math.max(1, limit)));
        if (!PermissionService.hasPermission(grants, PermissionEnum.NOTIFICATION_LOGS_VIEW_ALL)) {
            // Department access is restricted to recipients sharing a department.
            // Logs without a recipient cannot establish that scope and are excluded.
            query.andWhere(`EXISTS (
                SELECT 1 FROM user_department recipient_department
                INNER JOIN user_department viewer_department
                  ON viewer_department."departmentId" = recipient_department."departmentId"
                WHERE recipient_department."userId" = log."recipientId"
                  AND viewer_department."userId" = :viewerId
            )`, { viewerId: currentUser.id });
        }
        return query.getMany();
    }
}
