import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { User } from 'src/modules/user/models/user.model';
import { LoginResponseDto } from './dto/login-response.dto';
import { LoginRequestDto } from './dto/login-request.dto';
import { Hash } from 'src/shared/helpers/hash.helper';
import { AuthenticationError } from 'apollo-server-express';
import { Permission } from '../permission/models/permission.model';
import { Any } from 'typeorm';
import { Role } from '../permission/models/role.model';
import { SettingService } from '../setting/providers/setting.service';
import { SettingKey } from '../setting/enums/setting-name.enum';
import { AccessTokenService } from './providers/access-token.service';
import { CacheService } from 'src/shared';
import * as moment from 'moment';
import { EvaluationAutomationTriggerPoint } from '../evaluation-automation/enums/evaluation-automation-trigger-point.enum';

@Injectable()
export class AuthService {
    private readonly logger = new Logger('AuthService');

    constructor(
        private readonly settingService: SettingService,
        private readonly tokenService: AccessTokenService,
        private readonly cacheService: CacheService,
        private readonly moduleRef: ModuleRef,
    ) {}

    async login(loginDto: LoginRequestDto): Promise<LoginResponseDto> {
        const user = await this.validateUserCredentials(loginDto);
        const isFirstLogin = !user.firstLoginAt;

        await this.updateLoginTimestamps(user, isFirstLogin);

        const accessToken: string = await this.tokenService.generateToken(user);
        await this.dispatchFirstLoginAutomation(user, isFirstLogin);
        await this.dispatchLastLoginAutomation(user);

        return {
            accessToken: accessToken,
            user: user,
        } as LoginResponseDto;
    }

    private async validateUserCredentials(
        loginDto: LoginRequestDto,
    ): Promise<User> {
        // Username comparison done using lowercase
        const identifier = loginDto.identifier?.trim().toLowerCase();
        const password = loginDto.password;

        const user = await User.findOne({
            relations: ['roles'],
            where: [
                { username: identifier },
                { email: identifier },
            ],
        });

        // invalid username
        if (!user) {
            this.logger.debug(`Invalid Username: ${identifier}`);
            throw new AuthenticationError('Invalid Credentials');
        }

        // deactivated user
        if (!user.active) {
            this.logger.debug(`Deactivated User: ${identifier}`);
            throw new AuthenticationError(
                'User deactivated. Contact your administrator for support!',
            );
        }

        const maxLoginAttempts: number = await this.settingService.getKey(
            SettingKey.MAX_LOGIN_ATTEMPTS,
        );

        // Check max login attempts
        await this.checkPasswordAttemptsLock(user, maxLoginAttempts);

        // invalid password
        if (!(await Hash.compare(password, user.password))) {
            this.logger.debug(`Invalid Password for user: ${user.username}`);

            await this.executeInvalidLoginAttempt(user);

            throw new AuthenticationError(`Invalid Credentials!`);
        }

        // Unset failed passwords key
        await this.cacheService.manager().del(`login-attempts:${user.id}`);

        return user;
    }

    private async updateLoginTimestamps(
        user: User,
        isFirstLogin: boolean,
    ): Promise<void> {
        const now = new Date();
        if (isFirstLogin) {
            user.firstLoginAt = now;
        }
        user.previousLastLoginAt = user.lastLoginAt;
        user.lastLoginAt = now;
        await user.save();
    }

    private async dispatchFirstLoginAutomation(
        user: User,
        isFirstLogin: boolean,
    ): Promise<void> {
        if (!isFirstLogin) return;

        try {
            const automationEngine = this.moduleRef.get(
                'EVALUATION_AUTOMATION_ENGINE',
                { strict: false },
            ) as any;
            await automationEngine.handleTrigger({
                triggerPoint: EvaluationAutomationTriggerPoint.FIRST_LOGIN,
                userId: user.id,
                excludedAutomationIds: user.skippedAutomationIds || [],
            });
        } catch (error) {
            this.logger.error(
                `Unable to dispatch first_login automation for user ${user.id}: ${error?.message}`,
            );
        }
    }

    private async dispatchLastLoginAutomation(user: User): Promise<void> {
        try {
            const automationEngine = this.moduleRef.get(
                'EVALUATION_AUTOMATION_ENGINE',
                { strict: false },
            ) as any;
            await automationEngine.handleTrigger({
                triggerPoint: EvaluationAutomationTriggerPoint.LAST_LOGIN,
                userId: user.id,
                triggerOccurredAt: user.lastLoginAt || new Date(),
                excludedAutomationIds: user.skippedAutomationIds || [],
                metadata: {
                    previousLastLoginAt: user.previousLastLoginAt?.toISOString?.() || null,
                    lastLoginAt: user.lastLoginAt?.toISOString?.() || null,
                },
            });
        } catch (error) {
            this.logger.error(
                `Unable to dispatch last_login automation for user ${user.id}: ${error?.message}`,
            );
        }
    }

    async validateAccessToken(tokenId: string): Promise<User> {
        return this.tokenService.validateAccessToken(tokenId);
    }

    private async checkPasswordAttemptsLock(
        user: User,
        maxLoginAttempts: number,
    ) {
        const loginAttemptsKey = `login-attempts:${user.id}`;

        const cacheValue = await this.cacheService
            .manager()
            .get<string>(loginAttemptsKey);

        if (!cacheValue) {
            return;
        }

        const cacheObj = JSON.parse(cacheValue);

        const attempts = cacheObj?.attempts ?? cacheValue;
        const lastAttemptAt = cacheObj?.lastAttemptAt;

        const userLockOutTimeInMinutes = 5;

        if (
            attempts >= maxLoginAttempts &&
            lastAttemptAt &&
            moment().diff(lastAttemptAt, 'seconds') < userLockOutTimeInMinutes
        ) {
            throw new AuthenticationError(
                'User locked out due to failed attempts. Please wait and try again later!',
            );
        }
    }

    private async executeInvalidLoginAttempt(user: User) {
        const loginAttemptsKey = `login-attempts:${user.id}`;

        let attempts = await this.cacheService
            .manager()
            .get<number>(loginAttemptsKey);

        attempts = attempts + 1;

        const cacheValue = JSON.stringify({
            attempts,
            lastAttemptAt: moment().toString(),
        });

        await this.cacheService.manager().set(loginAttemptsKey, cacheValue);

        return attempts;
    }

    async userPermissionGrants(userInput: User): Promise<Permission[]> {
        // re-select the user
        const user = await User.findOne({
            relations: ['permissions', 'roles'],
            where: { id: userInput.id },
        });

        const directPermissions = user.permissions;

        const roleIds = user.roles.map(role => role.id);

        const roles = await Role.find({
            relations: ['permissions'],
            where: { id: Any(roleIds) },
        });

        const rolePermissions = roles.flatMap(role => role.permissions);

        return [...new Set([...directPermissions, ...rolePermissions])];
    }

    async logout(user: User): Promise<boolean> {
        return this.tokenService.revokeTokens(user);
    }
}
