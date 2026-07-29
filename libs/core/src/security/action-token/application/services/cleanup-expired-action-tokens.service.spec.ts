import { DATABASE_CONTEXT } from '@app/database';
import { CLOCK, Duration, FixedClock, Instant } from '@app/shared-kernel';
import { makeActionTokenRepositoryMock } from '@app/testing/core/security/action-token';
import { makeDatabaseContextMock } from '@app/testing/database';
import { Test, type TestingModule } from '@nestjs/testing';
import { TOKEN_REPOSITORY } from '../../domain/action-token.repository';
import { ActionTokenConfig, TOKEN_CONFIG } from '../../infrastructure/config/action-token.config';
import { CleanupExpiredActionTokensService } from './cleanup-expired-action-tokens.service';

const NOW = Instant.parse('2024-01-01T00:00:00Z');

describe('CleanupExpiredActionTokensService', () => {
  let module: TestingModule;
  let service: CleanupExpiredActionTokensService;

  const dbContext = makeDatabaseContextMock();
  const clock = new FixedClock(NOW);
  const config: ActionTokenConfig = {
    cleanupBatchSize: 2,
    retentionPeriod: Duration.days(1),
  };
  const repository = makeActionTokenRepositoryMock();

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        CleanupExpiredActionTokensService,
        { provide: CLOCK, useValue: clock },
        { provide: TOKEN_CONFIG, useValue: config },
        { provide: DATABASE_CONTEXT, useValue: dbContext },
        { provide: TOKEN_REPOSITORY, useValue: repository },
      ],
    }).compile();
    await module.init();
    service = module.get(CleanupExpiredActionTokensService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    jest.clearAllMocks();
    await module.close();
  });

  it('should delete expired tokens in batches until fewer rows than the batch size are deleted', async () => {
    repository.deleteExpired
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    const totalDeleted = await service.execute();
    expect(totalDeleted).toBe(5);
    expect(repository.deleteExpired).toHaveBeenCalledTimes(3);
  });

  it('should stop immediately if first batch is empty (i.e no expired token found)', async () => {
    repository.deleteExpired.mockResolvedValueOnce(0);
    const totalDeleted = await service.execute();
    expect(totalDeleted).toBe(0);
    expect(repository.deleteExpired).toHaveBeenCalledTimes(1);
  });

  it('should compute the cutoff time based on the current time and retention period', async () => {
    repository.deleteExpired.mockResolvedValueOnce(0);
    await service.execute();
    const expectedCutoff = NOW.minus(config.retentionPeriod);
    expect(repository.deleteExpired).toHaveBeenCalledWith(
      dbContext.operational,
      expectedCutoff,
      config.cleanupBatchSize,
    );
  });
});
