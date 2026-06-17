import { IDEMPOTENCY_HEADER } from '@app/common/constants';
import { REDIS } from '@app/core/infrastructure/redis';
import { OBFUSCATION } from '@app/core/security';
import { DATABASE_CONTEXT } from '@app/database';
import { makeRedisMock } from '@app/testing/core/infrastructure';
import {
  fsIdempotencyRecord,
  makeIdempotencyRepositoryMock,
} from '@app/testing/core/reliability/idempotency';
import { makeObfuscationMock } from '@app/testing/core/security';
import { makeDatabaseContextMock } from '@app/testing/database';
import { makeCallHandlerMock, makeRequestMock } from '@app/testing/system';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { IdempotencyOptions } from '../decorators/idempotency.decorator';
import { IdempotencyException } from '../exceptions/idempotency.exception';
import { IdempotencyRecord } from '../persistence/idempotency.persistence.types';
import { IDEMPOTENCY_REPOSITORY } from '../persistence/idempotency.port';
import { DurableIdempotencyStrategy } from './durable.strategy';

const OPTIONS: IdempotencyOptions = { strategy: 'durable', scope: 'payments' };

describe('DurableIdempotencyStrategy', () => {
  let module: TestingModule;
  let strategy: DurableIdempotencyStrategy;
  let callHandler: ReturnType<typeof makeCallHandlerMock>['callHandler'];
  let mockHandle: jest.Mock;

  const redis = makeRedisMock();
  const obfuscation = makeObfuscationMock();
  const dbContext = makeDatabaseContextMock();
  const idempotencyRepository = makeIdempotencyRepositoryMock();
  const request = makeRequestMock({ headers: { [IDEMPOTENCY_HEADER]: 'idem-key-1' } });

  const runStrategy = (options: IdempotencyOptions = OPTIONS, req: any = request) =>
    firstValueFrom(strategy.handle(req, callHandler, options));
  const getKey = (options: IdempotencyOptions = OPTIONS) => `idem:${options.scope}:idem-key-1`;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        DurableIdempotencyStrategy,
        { provide: REDIS, useValue: redis },
        { provide: OBFUSCATION, useValue: obfuscation },
        { provide: DATABASE_CONTEXT, useValue: dbContext },
        { provide: IDEMPOTENCY_REPOSITORY, useValue: idempotencyRepository },
      ],
    }).compile();
    await module.init();
    strategy = module.get(DurableIdempotencyStrategy);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    ({ callHandler, mockHandle } = makeCallHandlerMock());
    mockHandle.mockReturnValue(of('ok'));
    obfuscation.hash.mockReturnValue('hash-abc');
  });

  afterAll(async () => {
    jest.clearAllMocks();
    await module.close();
  });

  it("should throw if request doesn't have idempotency key header", async () => {
    const requestWithoutHeader = makeRequestMock();
    await expect(runStrategy(OPTIONS, requestWithoutHeader)).rejects.toThrow(BadRequestException);
    expect(callHandler.handle).not.toHaveBeenCalled();
  });

  describe('when fetching existing records', () => {
    it('should attempt to fetch existing record from redis', async () => {
      const record = fsIdempotencyRecord.generate({ status: 'completed' });
      obfuscation.hash.mockReturnValue(record.requestHash);
      redis.get.mockResolvedValue(record);
      await runStrategy();
      expect(redis.get).toHaveBeenCalledWith(getKey());
      expect(idempotencyRepository.findActiveRecord).not.toHaveBeenCalled();
    });

    it('should fallback to database if redis is unavailable', async () => {
      const record = fsIdempotencyRecord.generate({ status: 'completed' });
      obfuscation.hash.mockReturnValue(record.requestHash);
      redis.get.mockResolvedValue(null);
      idempotencyRepository.findActiveRecord.mockResolvedValue(record);
      await runStrategy();
      expect(redis.get).toHaveBeenCalledWith(getKey());
      expect(idempotencyRepository.findActiveRecord).toHaveBeenCalledWith(
        expect.anything(),
        'idem-key-1',
        'payments',
      );
    });
  });

  describe('when existing record exists', () => {
    it('should throw if request hash does not match stored hash', async () => {
      obfuscation.hash.mockReturnValue('different-hash');
      redis.get.mockResolvedValue(fsIdempotencyRecord.generate());
      await expect(runStrategy()).rejects.toThrow(new BadRequestException('Payload mismatch'));
      expect(callHandler.handle).not.toHaveBeenCalled();
    });

    it('should throw if record is in_progress', async () => {
      const record = fsIdempotencyRecord.generate({ status: 'in_progress' });
      obfuscation.hash.mockReturnValue(record.requestHash);
      redis.get.mockResolvedValue(record);
      await expect(runStrategy()).rejects.toThrow(ConflictException);
      expect(callHandler.handle).not.toHaveBeenCalled();
    });

    it('should replay the cached response', async () => {
      const record = fsIdempotencyRecord.generate({ status: 'completed' });
      obfuscation.hash.mockReturnValue(record.requestHash);
      redis.get.mockResolvedValue(record);
      await expect(runStrategy()).resolves.toEqual(record.response);
      expect(callHandler.handle).not.toHaveBeenCalled();
    });

    it('should replay the cached error and reconstruct it as an IdempotencyException', async () => {
      const record = fsIdempotencyRecord.generate({
        status: 'failed',
        error: { message: 'Validation failed', code: 'INVALID_ERROR' },
      });
      obfuscation.hash.mockReturnValue(record.requestHash);
      redis.get.mockResolvedValue(record);
      const error = await runStrategy().catch((err) => err);
      expect(error).toBeInstanceOf(IdempotencyException);
      expect(error).toMatchObject({
        message: 'Validation failed',
        code: 'INVALID_ERROR',
      });
      expect(callHandler.handle).not.toHaveBeenCalled();
    });
  });

  describe('when no existing record', () => {
    describe('when db create completed successfully without conflict', () => {
      const record = fsIdempotencyRecord.generate({ status: 'in_progress' });

      beforeEach(() => {
        redis.get.mockResolvedValue(null);
        idempotencyRepository.findActiveRecord.mockResolvedValue(null);
        idempotencyRepository.tryClaim.mockResolvedValue(true);
      });

      it('should call next.handle to process the request', async () => {
        const response = await runStrategy();
        expect(callHandler.handle).toHaveBeenCalledTimes(1);
        expect(response).toBe('ok');
      });

      it('should process the request and cache the successful response', async () => {
        const response = { transactionId: 'tx-1' };
        mockHandle.mockReturnValue(of(response));
        const updateRecord: IdempotencyRecord = { ...record, status: 'completed', response };
        idempotencyRepository.markCompleted.mockResolvedValue(updateRecord);
        const result = await runStrategy();
        expect(result).toEqual(response);
        expect(idempotencyRepository.markCompleted).toHaveBeenCalledWith(
          expect.anything(),
          'idem-key-1',
          'payments',
          response,
        );
        expect(redis.set).toHaveBeenCalledWith(
          getKey(),
          expect.objectContaining({ status: 'completed', response }),
          expect.any(Number),
        );
      });

      it('should cache deterministic errors and rethrow them', async () => {
        const err = new BadRequestException('Invalid input');
        mockHandle.mockReturnValue(throwError(() => err));
        const updateRecord: IdempotencyRecord = {
          ...record,
          status: 'failed',
          error: { message: err.message, status: err.getStatus() },
        };
        idempotencyRepository.markFailed.mockResolvedValue(updateRecord);
        await expect(runStrategy()).rejects.toThrow(BadRequestException);
        expect(idempotencyRepository.markFailed).toHaveBeenCalledWith(
          expect.anything(),
          'idem-key-1',
          'payments',
          expect.objectContaining({ message: 'Invalid input', status: err.getStatus() }),
        );
        expect(redis.set).toHaveBeenCalledWith(
          getKey(),
          expect.objectContaining({
            status: 'failed',
            error: expect.objectContaining({ message: 'Invalid input', status: err.getStatus() }),
          }),
          expect.any(Number),
        );
      });

      it('should delete the record on non-deterministic errors and rethrow them', async () => {
        const err = new Error('Redis crash');
        mockHandle.mockReturnValue(throwError(() => err));
        await expect(runStrategy()).rejects.toThrow('Redis crash');
        expect(idempotencyRepository.deleteRecord).toHaveBeenCalledWith(
          expect.anything(),
          'idem-key-1',
          'payments',
        );
        expect(redis.del).toHaveBeenCalledWith(getKey());
      });

      describe('when custom ttl is provided in options', () => {
        beforeEach(() => {
          jest.useFakeTimers();
          jest.setSystemTime(new Date('2026-06-07T12:00:00Z'));
        });

        afterEach(() => {
          jest.useRealTimers();
        });

        it('should use custom ttl from options when creating record', async () => {
          const options = { ...OPTIONS, ttlSeconds: 3600 };
          await runStrategy(options);
          expect(idempotencyRepository.tryClaim).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ ttl: 3600 }),
          );
        });

        it('should update redis ttl removing lapsed time when marking completed', async () => {
          mockHandle.mockReturnValue(of(record.response));
          const time30minsLater = new Date(Date.now() + 30 * 60 * 1000);
          const updateRecord: IdempotencyRecord = {
            ...record,
            status: 'completed',
            expiresAt: time30minsLater,
          };
          idempotencyRepository.markCompleted.mockResolvedValue(updateRecord);
          const options = { ...OPTIONS, ttlSeconds: 3600 };
          const result = await runStrategy(options);
          expect(result).toEqual(record.response);
          expect(redis.set).toHaveBeenCalledWith(
            getKey(options),
            expect.objectContaining({ status: 'completed' }),
            1800,
          );
        });

        it('should update redis ttl removing lapsed time when marking failed', async () => {
          const err = new BadRequestException('Invalid input');
          mockHandle.mockReturnValue(throwError(() => err));
          const time30minsLater = new Date(Date.now() + 30 * 60 * 1000);
          const updateRecord: IdempotencyRecord = {
            ...record,
            status: 'failed',
            expiresAt: time30minsLater,
            error: { message: err.message, status: err.getStatus() },
          };
          idempotencyRepository.markFailed.mockResolvedValue(updateRecord);
          const options = { ...OPTIONS, ttlSeconds: 3600 };
          await expect(runStrategy(options)).rejects.toThrow(BadRequestException);
          expect(redis.set).toHaveBeenCalledWith(
            getKey(options),
            expect.objectContaining({
              status: 'failed',
              error: expect.objectContaining({
                message: 'Invalid input',
                status: err.getStatus(),
              }),
            }),
            1800,
          );
        });
      });

      describe('how it determines whether an error is deterministic', () => {
        it.each([
          [429, 'Too Many Requests'],
          [408, 'Request Timeout'],
          [500, 'Internal Server Error'],
        ])('should treat status %i (%s) as non-deterministic', async (status, message) => {
          const err = new Error(message) as any;
          err.getStatus = () => status;
          mockHandle.mockReturnValue(throwError(() => err));
          await expect(runStrategy()).rejects.toThrow(message);
          expect(idempotencyRepository.deleteRecord).toHaveBeenCalledWith(
            expect.anything(),
            'idem-key-1',
            'payments',
          );
          expect(redis.del).toHaveBeenCalledWith(getKey());
        });

        it.each([
          [400, 'Bad Request'],
          [404, 'Not Found'],
        ])('should treat status %i (%s) as deterministic', async (status, message) => {
          const err = new Error(message) as any;
          err.getStatus = () => status;
          mockHandle.mockReturnValue(throwError(() => err));
          const updateRecord: IdempotencyRecord = {
            ...record,
            status: 'failed',
            error: { message: err.message, status: err.getStatus() },
          };
          idempotencyRepository.markFailed.mockResolvedValue(updateRecord);
          await expect(runStrategy()).rejects.toThrow(message);
          expect(idempotencyRepository.markFailed).toHaveBeenCalledWith(
            expect.anything(),
            'idem-key-1',
            'payments',
            expect.objectContaining({ message, status }),
          );
          expect(redis.set).toHaveBeenCalledWith(
            getKey(),
            expect.objectContaining({
              status: 'failed',
              error: expect.objectContaining({ message, status }),
            }),
            expect.any(Number),
          );
        });

        it('should use err.status if getStatus() is not available', async () => {
          const err = new Error('Validation failed') as any;
          err.status = 429;
          mockHandle.mockReturnValue(throwError(() => err));
          await expect(runStrategy()).rejects.toThrow('Validation failed');
          expect(idempotencyRepository.deleteRecord).toHaveBeenCalledWith(
            expect.anything(),
            'idem-key-1',
            'payments',
          );
          expect(redis.del).toHaveBeenCalledWith(getKey());
        });

        it('should resolve status from err.code via mapCodeToStatus when status is not available', async () => {
          const err = new Error('Domain error') as any;
          err.code = 'INVALID_ERROR';
          mockHandle.mockReturnValue(throwError(() => err));
          const updateRecord: IdempotencyRecord = {
            ...record,
            status: 'failed',
            error: { message: err.message, code: err.code },
          };
          idempotencyRepository.markFailed.mockResolvedValue(updateRecord);
          await expect(runStrategy()).rejects.toThrow('Domain error');
          expect(idempotencyRepository.markFailed).toHaveBeenCalledWith(
            expect.anything(),
            'idem-key-1',
            'payments',
            expect.objectContaining({ message: 'Domain error', status: 400 }),
          );
          expect(redis.set).toHaveBeenCalledWith(
            getKey(),
            expect.objectContaining({
              status: 'failed',
              error: expect.objectContaining({ message: 'Domain error', code: 'INVALID_ERROR' }),
            }),
            expect.any(Number),
          );
        });
      });
    });

    describe('when db create indicates a conflict', () => {
      beforeEach(() => {
        idempotencyRepository.tryClaim.mockResolvedValue(false);
      });

      it('should throw if record still not found after conflict', async () => {
        redis.get.mockResolvedValue(null); // both checks return null
        idempotencyRepository.findActiveRecord.mockResolvedValue(null);
        await expect(runStrategy()).rejects.toThrow(InternalServerErrorException);
        expect(callHandler.handle).not.toHaveBeenCalled();
      });

      it('should fetch and replay the existing record', async () => {
        const existingRecord = fsIdempotencyRecord.generate({ status: 'completed' });
        obfuscation.hash.mockReturnValue(existingRecord.requestHash);
        redis.get.mockResolvedValueOnce(null).mockResolvedValueOnce(existingRecord); // first check: no record, second check: found record after conflict
        idempotencyRepository.findActiveRecord.mockResolvedValue(null);
        const result = await runStrategy();
        expect(result).toEqual(existingRecord.response);
        expect(callHandler.handle).not.toHaveBeenCalled();
      });
    });
  });
});
