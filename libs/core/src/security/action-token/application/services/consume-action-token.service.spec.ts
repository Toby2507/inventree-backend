import { CRYPTOGRAPHY } from '@app/core/security/cryptography';
import { CLOCK, FixedClock, Instant } from '@app/shared-kernel';
import { faker } from '@app/testing';
import {
  feActionToken,
  makeActionTokenRepositoryMock,
} from '@app/testing/core/security/action-token';
import { makeCryptographyMock } from '@app/testing/core/security/cryptography';
import { makeDatabaseConnectionMock } from '@app/testing/database';
import { Test, type TestingModule } from '@nestjs/testing';
import { TOKEN_REPOSITORY } from '../../domain/action-token.repository';
import { ACTION_TOKEN_PURPOSES } from '../../domain/aggregates/action-token.types';
import { TokenNotFoundException } from '../exceptions/action-token.app.exceptions';
import type { ConsumeActionTokenCommand } from '../ports/consume-action-token';
import { ConsumeActionTokenService } from './consume-action-token.service';

const NOW = Instant.parse('2024-01-01T00:00:00Z');
const HASH = faker.string.alphanumeric(44);

describe('ConsumeActionTokenService', () => {
  let module: TestingModule;
  let service: ConsumeActionTokenService;

  const db = makeDatabaseConnectionMock();
  const clock = new FixedClock(NOW);
  const cryptography = makeCryptographyMock();
  const repository = makeActionTokenRepositoryMock();

  const command: ConsumeActionTokenCommand = {
    token: faker.string.alphanumeric(32),
    purpose: ACTION_TOKEN_PURPOSES.EMAIL_CHANGE,
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        ConsumeActionTokenService,
        { provide: CLOCK, useValue: clock },
        { provide: CRYPTOGRAPHY, useValue: cryptography },
        { provide: TOKEN_REPOSITORY, useValue: repository },
      ],
    }).compile();
    await module.init();
    service = module.get(ConsumeActionTokenService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    cryptography.sha256.mockReturnValue(HASH);
  });

  afterAll(async () => {
    jest.clearAllMocks();
    await module.close();
  });

  it('should hash the input token and look it up in the repository', async () => {
    const token = feActionToken.generate({ purpose: command.purpose });
    repository.findByHash.mockResolvedValueOnce(token);
    await service.execute(db, command);
    expect(cryptography.sha256).toHaveBeenCalledWith(command.token);
    expect(repository.findByHash).toHaveBeenCalledWith(db, HASH);
  });

  it('should throw TokenNotFoundException when no token matches the hash', async () => {
    repository.findByHash.mockResolvedValueOnce(null);
    await expect(service.execute(db, command)).rejects.toThrow(TokenNotFoundException);
  });

  it('should consume the token with the given purpose at the current time', async () => {
    const token = feActionToken.generate({ purpose: command.purpose });
    const consumeSpy = jest.spyOn(token, 'consume');
    repository.findByHash.mockResolvedValueOnce(token);
    await service.execute(db, command);
    expect(consumeSpy).toHaveBeenCalledWith(command.purpose, clock.now());
    consumeSpy.mockRestore();
  });

  it('should persist the consumed token in the repository', async () => {
    const token = feActionToken.generate({ purpose: command.purpose });
    repository.findByHash.mockResolvedValueOnce(token);
    await service.execute(db, command);
    expect(repository.update).toHaveBeenCalledWith(db, token);
  });

  it('should return the consumed token', async () => {
    const token = feActionToken.generate({ purpose: command.purpose });
    repository.findByHash.mockResolvedValueOnce(token);
    const result = await service.execute(db, command);
    expect(result).toBe(token);
  });
});
