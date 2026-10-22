jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuthResolver } from './auth.resolver';
import { User } from '../user/models/user.model';
import { LoginRequestDto } from './dto/login-request.dto';

describe('Personal preferences authorization and login', () => {
    afterEach(() => jest.restoreAllMocks());
    it('updates only the authenticated user and permits automatic mode', async () => {
        const update = jest.spyOn(User, 'update').mockResolvedValue({} as any);
        const resolver = new AuthResolver({} as any);
        await resolver.updateMyPreferences({ id: 7, timezone: 'Asia/Tokyo' } as User, {
            timezone: null, detectedTimezone: 'America/Argentina/Buenos_Aires',
        });
        expect(update).toHaveBeenCalledWith(7, { timezone: null, detectedTimezone: 'America/Argentina/Buenos_Aires' });
    });
    it('rejects invalid zones before persisting any changes', async () => {
        const update = jest.spyOn(User, 'update').mockResolvedValue({} as any);
        const resolver = new AuthResolver({} as any);
        await expect(resolver.updateMyPreferences({ id: 7 } as User, { timezone: 'invalid' })).rejects.toThrow('Invalid timezone');
        expect(update).not.toHaveBeenCalled();
    });
    it('retains identifier and password when whitelist validation processes the new login field', async () => {
        const dto = plainToInstance(LoginRequestDto, { identifier: 'test', password: 'secret', detectedTimezone: 'UTC' });
        expect(await validate(dto, { whitelist: true, forbidUnknownValues: false })).toEqual([]);
        expect(dto.identifier).toBe('test');
        expect(dto.password).toBe('secret');
    });
});
