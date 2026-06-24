import { DATABASE_CONTEXT } from '@app/database';
import { makeIdempotencyRepositoryMock } from '@app/testing/core/reliability/idempotency';
import { makeDatabaseContextMock } from '@app/testing/database';
import { Test, TestingModule } from '@nestjs/testing';
import { IDEMPOTENCY_REPOSITORY } from '../persistence/idempotency.port';
import { IdempotencyService } from './idempotency.service';

describe('IdempotencyService', () => {
  let module: TestingModule;
  let service: IdempotencyService;

  const dbContext = makeDatabaseContextMock();
  const repository = makeIdempotencyRepositoryMock();

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        { provide: DATABASE_CONTEXT, useValue: dbContext },
        { provide: IDEMPOTENCY_REPOSITORY, useValue: repository },
      ],
    }).compile();
    await module.init();
    service = module.get(IdempotencyService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    jest.clearAllMocks();
    await module.close();
  });

  it('should delegate to repository to sweep stale in-progress records', async () => {
    await service.sweepStaleInProgress();
    expect(dbContext.platformCommand).toHaveBeenCalledTimes(1);
    expect(repository.sweepStaleInProgress).toHaveBeenCalledWith(dbContext.operational);
  });

  it('should delegate to repository to delete expired records', async () => {
    await service.deleteExpiredRecords();
    expect(dbContext.platformCommand).toHaveBeenCalledTimes(1);
    expect(repository.deleteExpired).toHaveBeenCalledWith(dbContext.operational);
  });
});
