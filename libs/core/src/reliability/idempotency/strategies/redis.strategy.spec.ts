import { IDEMPOTENCY_HEADER } from '@app/common/constants';
import { REDIS } from '@app/core/infrastructure/redis';
import { OBFUSCATION } from '@app/core/security';
import { makeRedisMock } from '@app/testing/core/infrastructure';
import { fsRedisIdempotencyRecord } from '@app/testing/core/reliability/idempotency';
import { makeObfuscationMock } from '@app/testing/core/security';
import { makeCallHandlerMock, makeRequestMock } from '@app/testing/system';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { IdempotencyOptions } from '../decorators/idempotency.decorator';
import { IdempotencyException } from '../exceptions/idempotency.exception';
import { RedisIdempotencyStrategy } from './redis.strategy';

const OPTIONS: IdempotencyOptions = { strategy: 'redis', scope: 'payments' };

describe('RedisIdempotencyStrategy', () => {
  let module: TestingModule;
  let strategy: RedisIdempotencyStrategy;
  let callHandler: ReturnType<typeof makeCallHandlerMock>['callHandler'];
  let mockHandle: jest.Mock;

  const redis = makeRedisMock();
  const obfuscation = makeObfuscationMock();
  const request = makeRequestMock({ headers: { [IDEMPOTENCY_HEADER]: 'idem-key-1' } });

  const runStrategy = (options: IdempotencyOptions = OPTIONS, req: any = request) =>
    firstValueFrom(strategy.handle(req, callHandler, options));
  const getKey = (options: IdempotencyOptions = OPTIONS) => `idem:${options.scope}:idem-key-1`;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        RedisIdempotencyStrategy,
        { provide: REDIS, useValue: redis },
        { provide: OBFUSCATION, useValue: obfuscation },
      ],
    }).compile();
    await module.init();
    strategy = module.get(RedisIdempotencyStrategy);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    ({ callHandler, mockHandle } = makeCallHandlerMock());
    mockHandle.mockReturnValue(of('ok'));
    obfuscation.hash.mockReturnValue('hash-abc');
    redis.set.mockResolvedValue('OK');
    redis.del.mockResolvedValue(1);
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

  it('should throw if redis is unavailable', async () => {
    const error = new Error('ECONNREFUSED');
    redis.get.mockRejectedValue(error);
    await expect(runStrategy()).rejects.toThrow(ServiceUnavailableException);
    expect(callHandler.handle).not.toHaveBeenCalled();
  });

  describe('when existing record exists', () => {
    it('should throw if request hash does not match stored hash', async () => {
      obfuscation.hash.mockReturnValue('different-hash');
      redis.get.mockResolvedValue(fsRedisIdempotencyRecord.generate());
      await expect(runStrategy()).rejects.toThrow(new BadRequestException('Payload mismatch'));
      expect(callHandler.handle).not.toHaveBeenCalled();
    });

    it('should throw if record is in_progress', async () => {
      const record = fsRedisIdempotencyRecord.generate({ status: 'in_progress' });
      obfuscation.hash.mockReturnValue(record.requestHash);
      redis.get.mockResolvedValue(record);
      await expect(runStrategy()).rejects.toThrow(ConflictException);
      expect(callHandler.handle).not.toHaveBeenCalled();
    });

    it('should replay the cached response', async () => {
      const record = fsRedisIdempotencyRecord.generate({ status: 'completed' });
      obfuscation.hash.mockReturnValue(record.requestHash);
      redis.get.mockResolvedValue(record);
      await expect(runStrategy()).resolves.toEqual(record.response);
      expect(callHandler.handle).not.toHaveBeenCalled();
    });

    it('should replay the cached error and reconstruct it as an IdempotencyException', async () => {
      const record = fsRedisIdempotencyRecord.generate({
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
    describe('when setNX indicates a new record was created', () => {
      beforeEach(() => {
        redis.get.mockResolvedValue(null);
        redis.setNX.mockResolvedValue('OK'); // new key created
      });

      it('should call next.handle to process the request', async () => {
        const response = await runStrategy();
        expect(callHandler.handle).toHaveBeenCalledTimes(1);
        expect(response).toBe('ok');
      });

      it('should process the request and cache the successful response', async () => {
        const response = { transactionId: 'tx-1' };
        mockHandle.mockReturnValue(of(response));
        const result = await runStrategy();
        expect(result).toEqual(response);
        expect(redis.set).toHaveBeenCalledWith(
          getKey(),
          expect.objectContaining({ status: 'completed', response }),
          expect.any(Number),
        );
      });

      it('should cache deterministic errors and rethrow them', async () => {
        const err = new BadRequestException('Invalid input');
        mockHandle.mockReturnValue(throwError(() => err));
        await expect(runStrategy()).rejects.toThrow(BadRequestException);
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
        expect(redis.del).toHaveBeenCalledWith(getKey());
        expect(redis.set).not.toHaveBeenCalled();
      });

      describe('when custom ttl is provided in options', () => {
        it('should use custom ttl from options when marking completed', async () => {
          const options = { ...OPTIONS, ttlSeconds: 3600 };
          const result = await runStrategy(options);
          expect(result).toBe('ok');
          expect(redis.set).toHaveBeenCalledWith(
            getKey(options),
            expect.objectContaining({ status: 'completed' }),
            3600,
          );
        });

        it('should use custom ttl from options when marking failed', async () => {
          const options = { ...OPTIONS, ttlSeconds: 3600 };
          const err = new BadRequestException('Invalid input');
          mockHandle.mockReturnValue(throwError(() => err));
          await expect(runStrategy(options)).rejects.toThrow(BadRequestException);
          expect(redis.set).toHaveBeenCalledWith(
            getKey(options),
            expect.objectContaining({
              status: 'failed',
              error: expect.objectContaining({ message: 'Invalid input', status: err.getStatus() }),
            }),
            3600,
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
          expect(redis.del).toHaveBeenCalledWith(getKey());
          expect(redis.set).not.toHaveBeenCalled();
        });

        it.each([
          [400, 'Bad Request'],
          [404, 'Not Found'],
        ])('should treat status %i (%s) as deterministic', async (status, message) => {
          const err = new Error(message) as any;
          err.getStatus = () => status;
          mockHandle.mockReturnValue(throwError(() => err));
          await expect(runStrategy()).rejects.toThrow(message);
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
          expect(redis.del).toHaveBeenCalledWith(getKey());
          expect(redis.set).not.toHaveBeenCalled();
        });

        it('should resolve status from err.code via mapCodeToStatus when status is not available', async () => {
          const err = new Error('Domain error') as any;
          err.code = 'INVALID_ERROR';
          mockHandle.mockReturnValue(throwError(() => err));
          await expect(runStrategy()).rejects.toThrow('Domain error');
          expect(redis.set).toHaveBeenCalledWith(
            getKey(),
            expect.objectContaining({
              status: 'failed',
              error: expect.objectContaining({ message: 'Domain error', status: 400 }),
            }),
            expect.any(Number),
          );
        });
      });
    });

    describe('when setNX indicates a race condition (key already exists)', () => {
      const record = fsRedisIdempotencyRecord.generate({
        status: 'completed',
        requestHash: 'hash-abc',
      });

      beforeEach(() => {
        redis.setNX.mockResolvedValue(null); // key already existed
      });

      it('should throw if record still not found after race', async () => {
        redis.get.mockResolvedValue(null).mockResolvedValueOnce(null); // both checks return null
        await expect(runStrategy()).rejects.toThrow(InternalServerErrorException);
        expect(callHandler.handle).not.toHaveBeenCalled();
      });

      it('should fetch and replay the existing record', async () => {
        redis.get.mockResolvedValueOnce(null).mockResolvedValueOnce(record); // first check: no record, second check: found record after race
        const result = await runStrategy();
        expect(result).toEqual(record.response);
        expect(callHandler.handle).not.toHaveBeenCalled();
      });
    });
  });
});
