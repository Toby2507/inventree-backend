import { makeContext, makeReflector } from '@app/testing';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = makeReflector();
    guard = new JwtAuthGuard(reflector);
  });

  describe('when route is marked @Public()', () => {
    it('returns true without invoking Passport', () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const { context } = makeContext();
      expect(guard.canActivate(context)).toBe(true);
    });

    it('reads the correct metadata key', () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const { context } = makeContext();
      guard.canActivate(context);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    });
  });

  describe('when route is not @Public()', () => {
    it('delegates to super.canActivate() (Passport JWT)', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const superCanActivate = jest
        .spyOn(Object.getPrototypeOf(JwtAuthGuard).prototype, 'canActivate')
        .mockReturnValue(true);
      const { context } = makeContext();
      guard.canActivate(context);
      expect(superCanActivate).toHaveBeenCalled();
      superCanActivate.mockRestore();
    });
  });
});
