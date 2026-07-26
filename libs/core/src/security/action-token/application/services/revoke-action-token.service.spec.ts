import { CLOCK, FixedClock, Instant } from '@app/shared-kernel';
import { faker } from '@app/testing';
import {
  feActionToken,
  makeActionTokenRepositoryMock,
} from '@app/testing/core/security/action-token';
import { makeDatabaseConnectionMock } from '@app/testing/database';
import { Test, type TestingModule } from '@nestjs/testing';
import { TOKEN_REPOSITORY } from '../../domain/action-token.repository';
import {
  ACTION_TOKEN_PURPOSES,
  ACTION_TOKEN_REVOKE_REASONS,
} from '../../domain/aggregates/action-token.types';
import { ActionTokenID } from '../../domain/value-objects/action-token-id.vo';
import {
  RevokeAllTokensForUserCommand,
  RevokeTokenByIdCommand,
  RevokeTokenByPurposeCommand,
} from '../ports/revoke-action-token.port';
import { RevokeActionTokenService } from './revoke-action.token.service';

const NOW = Instant.parse('2024-01-01T00:00:00Z');

describe('RevokeActionTokenService', () => {
  let module: TestingModule;
  let service: RevokeActionTokenService;

  const db = makeDatabaseConnectionMock();
  const clock = new FixedClock(NOW);
  const repository = makeActionTokenRepositoryMock();

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        RevokeActionTokenService,
        { provide: CLOCK, useValue: clock },
        { provide: TOKEN_REPOSITORY, useValue: repository },
      ],
    }).compile();
    await module.init();
    service = module.get(RevokeActionTokenService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    jest.clearAllMocks();
    await module.close();
  });

  describe('revoking all tokens for a user', () => {
    const command: RevokeAllTokensForUserCommand = {
      userId: faker.string.uuid(),
      reason: ACTION_TOKEN_REVOKE_REASONS.ATTEMPTS_EXCEEDED,
    };

    it('should look up all usable tokens for the user at the current time', async () => {
      repository.findUsableByUser.mockResolvedValueOnce([]);
      await service.allForUser(db, command);
      expect(repository.findUsableByUser).toHaveBeenCalledWith(db, command.userId, clock.now());
    });

    it('should be no-op if no token is found for user at the current time', async () => {
      repository.findUsableByUser.mockResolvedValueOnce([]);
      await service.allForUser(db, command);
      expect(repository.revokeUsableByIds).not.toHaveBeenCalled();
    });

    it('should revoke all found tokens with the given reason at the current time', async () => {
      const tokens = feActionToken.generateMany(3, { userId: command.userId });
      repository.findUsableByUser.mockResolvedValueOnce(tokens);
      await service.allForUser(db, command);
      for (const token of tokens) {
        expect(token.isRevoked()).toBe(true);
        expect(token.toSnapshot().revokedReason).toBe(command.reason);
      }
    });

    it('should bulk revoke all returned tokens in the repository with the given reason at the current time', async () => {
      const tokens = feActionToken.generateMany(2, { userId: command.userId });
      repository.findUsableByUser.mockResolvedValueOnce(tokens);
      await service.allForUser(db, command);
      expect(repository.revokeUsableByIds).toHaveBeenCalledWith(
        db,
        tokens.map((t) => t.id.value),
        command.reason,
        clock.now(),
      );
    });
  });

  describe('revoking a token by id', () => {
    const command: RevokeTokenByIdCommand = {
      tokenId: ActionTokenID.from(faker.string.uuid()),
      reason: ACTION_TOKEN_REVOKE_REASONS.ATTEMPTS_EXCEEDED,
    };

    it('should look up the token by id', async () => {
      repository.findById.mockResolvedValueOnce(null);
      await service.byId(db, command);
      expect(repository.findById).toHaveBeenCalledWith(db, command.tokenId.value);
    });

    it('should be no-op if no token is found for the given id', async () => {
      repository.findById.mockResolvedValueOnce(null);
      await expect(service.byId(db, command)).resolves.toBeUndefined();
      expect(repository.revokeUsableByIds).not.toHaveBeenCalled();
    });

    it('should revoke the token instance with the given reason at the current time', async () => {
      const token = feActionToken.generate({ id: command.tokenId.value });
      repository.findById.mockResolvedValueOnce(token);
      await service.byId(db, command);
      expect(token.isRevoked()).toBe(true);
      expect(token.toSnapshot().revokedReason).toBe(command.reason);
    });

    it('should bulk revoke the token in the repository with the given reason at the current time', async () => {
      const token = feActionToken.generate({ id: command.tokenId.value });
      repository.findById.mockResolvedValueOnce(token);
      await service.byId(db, command);
      expect(repository.revokeUsableByIds).toHaveBeenCalledWith(
        db,
        [token.id.value],
        command.reason,
        clock.now(),
      );
    });
  });

  describe('revoking all tokens issued to a user for a specific purpose', () => {
    const command: RevokeTokenByPurposeCommand = {
      userId: faker.string.uuid(),
      purpose: ACTION_TOKEN_PURPOSES.EMAIL_VERIFICATION,
      reason: ACTION_TOKEN_REVOKE_REASONS.MANUAL,
    };

    it('should look up usable tokens for the user and purpose at the current time', async () => {
      repository.findUsableByUserAndPurpose.mockResolvedValueOnce([]);
      await service.byPurpose(db, command);
      expect(repository.findUsableByUserAndPurpose).toHaveBeenCalledWith(
        db,
        command.userId,
        command.purpose,
        clock.now(),
      );
    });

    it('should be no-op if no tokens were found for the user and purpose', async () => {
      repository.findUsableByUserAndPurpose.mockResolvedValueOnce([]);
      await expect(service.byPurpose(db, command)).resolves.toBeUndefined();
      expect(repository.revokeUsableByIds).not.toHaveBeenCalled();
    });

    it('should revoke the token instances with the given reason at the current time', async () => {
      const tokens = feActionToken.generateMany(2);
      repository.findUsableByUserAndPurpose.mockResolvedValueOnce(tokens);
      await service.byPurpose(db, command);
      for (const token of tokens) {
        expect(token.isRevoked()).toBe(true);
        expect(token.toSnapshot().revokedReason).toBe(command.reason);
      }
    });

    it('should bulk revoke the tokens in the repository with the given reason at the current time', async () => {
      const tokens = feActionToken.generateMany(2);
      repository.findUsableByUserAndPurpose.mockResolvedValueOnce(tokens);
      await service.byPurpose(db, command);
      expect(repository.revokeUsableByIds).toHaveBeenCalledWith(
        db,
        tokens.map((t) => t.id.value),
        command.reason,
        clock.now(),
      );
    });
  });
});
