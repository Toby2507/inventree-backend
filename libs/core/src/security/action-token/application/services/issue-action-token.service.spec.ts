import { ID_GENERATOR } from '@app/core/generators';
import { CRYPTOGRAPHY } from '@app/core/security/cryptography';
import { CLOCK, Duration, FixedClock, Instant } from '@app/shared-kernel';
import { faker } from '@app/testing';
import { makeIdGeneratorMock } from '@app/testing/core/generators';
import {
  feActionToken,
  makeActionTokenPolicyRegistryMock,
  makeActionTokenRepositoryMock,
} from '@app/testing/core/security/action-token';
import { makeCryptographyMock } from '@app/testing/core/security/cryptography';
import { makeDatabaseConnectionMock } from '@app/testing/database';
import { Test, type TestingModule } from '@nestjs/testing';
import { TOKEN_REPOSITORY } from '../../domain/action-token.repository';
import { ActionToken } from '../../domain/aggregates/action-token.aggregate';
import {
  ACTION_TOKEN_PURPOSES,
  ACTION_TOKEN_REVOKE_REASONS,
} from '../../domain/aggregates/action-token.types';
import { POLICY_REGISTRY } from '../../domain/policies/action-token-policy.registry';
import type { IssueActionTokenCommand } from '../ports/issue-action-token.port';
import { IssueActionTokenService } from './issue-action-token.service';

const NOW = Instant.parse('2024-01-01T00:00:00Z');

describe('IssueActionTokenService', () => {
  let module: TestingModule;
  let service: IssueActionTokenService;

  const db = makeDatabaseConnectionMock();
  const clock = new FixedClock(NOW);
  const cryptography = makeCryptographyMock();
  const idGenerator = makeIdGeneratorMock();
  const policyRegistry = makeActionTokenPolicyRegistryMock();
  const repository = makeActionTokenRepositoryMock();

  const basePolicy = {
    purpose: ACTION_TOKEN_PURPOSES.EMAIL_CHANGE,
    singleActiveInstance: false,
    ttl: Duration.hours(1),
  };
  const command: IssueActionTokenCommand = {
    userId: faker.string.uuid(),
    purpose: ACTION_TOKEN_PURPOSES.EMAIL_CHANGE,
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        IssueActionTokenService,
        { provide: CLOCK, useValue: clock },
        { provide: CRYPTOGRAPHY, useValue: cryptography },
        { provide: ID_GENERATOR, useValue: idGenerator },
        { provide: POLICY_REGISTRY, useValue: policyRegistry },
        { provide: TOKEN_REPOSITORY, useValue: repository },
      ],
    }).compile();
    await module.init();
    service = module.get(IssueActionTokenService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    idGenerator.generateUUIDV7.mockReturnValue(faker.string.uuid());
    cryptography.randomToken.mockReturnValue(faker.string.alphanumeric(32));
    cryptography.sha256.mockReturnValue(faker.string.alphanumeric(44));
    policyRegistry.resolve.mockReturnValue(basePolicy);
  });

  afterAll(async () => {
    jest.clearAllMocks();
    await module.close();
  });

  describe('policy resolution', () => {
    it('should resolve the policy for the given purpose', async () => {
      await service.execute(db, command);
      expect(policyRegistry.resolve).toHaveBeenCalledWith(command.purpose);
    });
  });

  describe('active instance handling', () => {
    describe('when the policy allows multiple active instances', () => {
      beforeEach(() => {
        policyRegistry.resolve.mockReturnValueOnce({
          ...basePolicy,
          singleActiveInstance: false,
        });
      });

      it('should not look up or revoke existing tokens', async () => {
        await service.execute(db, command);
        expect(repository.findUsableByUserAndPurpose).not.toHaveBeenCalled();
        expect(repository.revokeUsableByIds).not.toHaveBeenCalled();
      });
    });

    describe('when the policy allows only a single active instance', () => {
      beforeEach(() => {
        policyRegistry.resolve.mockReturnValueOnce({
          ...basePolicy,
          singleActiveInstance: true,
        });
      });

      it('should look up existing usable tokens for the user and purpose at the current time', async () => {
        repository.findUsableByUserAndPurpose.mockResolvedValueOnce([]);
        await service.execute(db, command);
        expect(repository.findUsableByUserAndPurpose).toHaveBeenCalledWith(
          db,
          command.userId,
          command.purpose,
          clock.now(),
        );
      });

      it('should skip calling revokeUsableByIds if not existing tokens are found', async () => {
        repository.findUsableByUserAndPurpose.mockResolvedValueOnce([]);
        await service.execute(db, command);
        expect(repository.revokeUsableByIds).not.toHaveBeenCalled();
      });

      it('should revoke existing usable tokens instances because they are superseded by the new token', async () => {
        const tokens = feActionToken.generateMany(2);
        repository.findUsableByUserAndPurpose.mockResolvedValueOnce(tokens);
        await service.execute(db, command);
        expect(repository.revokeUsableByIds).toHaveBeenCalledWith(
          db,
          tokens.map((t) => t.id.value),
          ACTION_TOKEN_REVOKE_REASONS.SUPERSEDED,
          clock.now(),
        );
      });

      it('should revoke existing tokens before issuing the new token', async () => {
        const tokens = feActionToken.generateMany(2);
        repository.findUsableByUserAndPurpose.mockResolvedValueOnce(tokens);
        await service.execute(db, command);
        const revokeCallOrder = repository.revokeUsableByIds.mock.invocationCallOrder[0];
        const createCallOrder = repository.create.mock.invocationCallOrder[0];
        expect(revokeCallOrder).toBeLessThan(createCallOrder);
      });
    });
  });

  describe('issuing a new token', () => {
    it('should generate a new id for the token via the id generator', async () => {
      await service.execute(db, command);
      expect(idGenerator.generateUUIDV7).toHaveBeenCalledTimes(1);
    });

    it('should generate a random token and hash it via the cryptography service', async () => {
      cryptography.randomToken.mockReturnValueOnce('random-token');
      await service.execute(db, command);
      expect(cryptography.randomToken).toHaveBeenCalledTimes(1);
      expect(cryptography.sha256).toHaveBeenCalledWith('random-token');
    });

    it('should create a new action token entity with the correct properties', async () => {
      const createSpy = jest.spyOn(ActionToken, 'create');
      await service.execute(db, command);
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: command.userId,
          purpose: command.purpose,
          tokenHash: expect.any(String),
          expiresAt: clock.now().plus(basePolicy.ttl),
          createdAt: clock.now(),
        }),
      );
      createSpy.mockRestore();
    });

    it('should persist the new action token entity via the repository', async () => {
      await service.execute(db, command);
      expect(repository.create).toHaveBeenCalledTimes(1);
      expect(repository.create).toHaveBeenCalledWith(db, expect.any(ActionToken));
    });

    it('should return the token, expiresAt, and expiresIn values', async () => {
      const result = await service.execute(db, command);
      expect(result).toEqual(
        expect.objectContaining({
          token: expect.any(String),
          expiresAt: clock.now().plus(basePolicy.ttl),
          expiresIn: basePolicy.ttl,
        }),
      );
    });
  });
});
