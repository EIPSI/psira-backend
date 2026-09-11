import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from './constants';
import { JwtStrategy } from './jwt.strategy';
import { AuthResolver } from './auth.resolver';
import { SettingModule } from '../setting/setting.module';
import { AccessTokenService } from './providers/access-token.service';
import { InformedConsentModule } from '../informed-consent/informed-consent.module';
import { AccessTokenRetentionService } from './providers/access-token-retention.service';

@Module({
    imports: [
        SettingModule,
        InformedConsentModule,
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
            secret: jwtConstants.secret,
            signOptions: { expiresIn: jwtConstants.tokenLife },
        }),
    ],
    providers: [
        AuthService,
        AuthResolver,
        JwtStrategy,
        AccessTokenService,
        AccessTokenRetentionService,
    ],
    exports: [JwtStrategy, PassportModule],
})
export class AuthModule { }
