import { IDEMPOTENCY_HEADER } from '@app/common/constants';
import { mapCodeToStatus } from '@app/common/exceptions';
import { JsonValue } from '@app/common/types';
import { REDIS, RedisPort } from '@app/core/infrastructure/redis';
import { OBFUSCATION, ObfuscationPort } from '@app/core/security';
import {
  BadRequestException,
  CallHandler,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, catchError, defer, from, of, throwError } from 'rxjs';
import { map, mergeMap, switchMap } from 'rxjs/operators';
import { IdempotencyOptions } from '../decorators/idempotency.decorator';
import { IdempotencyException } from '../exceptions/idempotency.exception';
import { IdempotencyRedisRecord } from '../persistence/idempotency.persistence.types';
import { IdempotencyStrategy } from './interface';

@Injectable()
export class RedisIdempotencyStrategy implements IdempotencyStrategy {
  private readonly IP_TTL_SECONDS = 300; // 5 minutes
  private readonly TTL_SECONDS = 86_400; // 24 hours

  constructor(
    @Inject(REDIS) private readonly redis: RedisPort,
    @Inject(OBFUSCATION) private readonly obfuscation: ObfuscationPort,
  ) {}

  handle<T>(request: Request, next: CallHandler, options: IdempotencyOptions): Observable<T> {
    return defer(async () => {
      const key = request.header(IDEMPOTENCY_HEADER);
      if (!key) throw new BadRequestException('Missing Idempotency-Key');
      const hash = this.obfuscation.hash(request.body);
      const existingRecord = await this.getRecord(key, options.scope);
      if (existingRecord) {
        const record = this.resolveExistingRecord(existingRecord, hash);
        return this.replayRecord<T>(record);
      }
      const created = await this.createRecord(key, options.scope, hash);
      if (created) {
        return next.handle().pipe(
          switchMap((response) =>
            from(this.markCompleted(key, options, hash, response)).pipe(map(() => response as T)),
          ),
          catchError((err) => {
            if (this.isDeterministicError(err)) {
              const errorPayload = {
                message: err.message,
                code: err.code,
                status: err.status ?? err.getStatus?.(),
                name: err.name,
              };
              return from(this.markFailed(key, options, hash, errorPayload)).pipe(
                mergeMap(() => throwError(() => err)),
              );
            }
            return from(this.deleteRecord(key, options.scope)).pipe(
              mergeMap(() => throwError(() => err)),
            );
          }),
        );
      } else {
        const existingRecord = await this.getRecord(key, options.scope);
        if (!existingRecord) throw new InternalServerErrorException('Idempotency record not found');
        const record = this.resolveExistingRecord(existingRecord, hash);
        return this.replayRecord<T>(record);
      }
    }).pipe(switchMap((result) => result));
  }

  private async getRecord(key: string, scope: string): Promise<IdempotencyRedisRecord | null> {
    try {
      return await this.redis.get<IdempotencyRedisRecord | null>(this.getRedisKey(key, scope));
    } catch {
      throw new ServiceUnavailableException('Idempotency service unavailable');
    }
  }

  private async createRecord(key: string, scope: string, hash: string): Promise<boolean> {
    const record: IdempotencyRedisRecord = { requestHash: hash, status: 'in_progress' };
    const res = await this.redis.setNX(this.getRedisKey(key, scope), record, this.IP_TTL_SECONDS);
    return res === 'OK';
  }

  private async deleteRecord(key: string, scope: string): Promise<void> {
    await this.redis.del(this.getRedisKey(key, scope));
  }

  private async markCompleted(
    key: string,
    options: IdempotencyOptions,
    hash: string,
    response: JsonValue,
  ) {
    const record: IdempotencyRedisRecord = { requestHash: hash, status: 'completed', response };
    const ttl = options.ttlSeconds ?? this.TTL_SECONDS;
    await this.redis.set(this.getRedisKey(key, options.scope), record, ttl);
  }

  private async markFailed(
    key: string,
    options: IdempotencyOptions,
    hash: string,
    error: JsonValue,
  ): Promise<void> {
    const record: IdempotencyRedisRecord = { requestHash: hash, status: 'failed', error };
    const ttl = options.ttlSeconds ?? this.TTL_SECONDS;
    await this.redis.set(this.getRedisKey(key, options.scope), record, ttl);
  }

  private isDeterministicError(err: any): boolean {
    let status = 0;
    if (err && typeof err.getStatus === 'function') status = err.getStatus();
    else if (err?.status) status = err.status;
    if (status === 0 && err.code) {
      status = mapCodeToStatus(err.code);
      err.status = status; // Attach mapped status back to error for later use
    }
    if (status >= 400 && status < 500) return status !== 429 && status !== 408;
    return false;
  }

  private getRedisKey(key: string, scope: string): string {
    return `idem:${scope}:${key}`;
  }

  private resolveExistingRecord(
    record: IdempotencyRedisRecord,
    hash: string,
  ): IdempotencyRedisRecord {
    if (record.requestHash !== hash) throw new BadRequestException('Payload mismatch');
    if (record.status === 'in_progress') throw new ConflictException('Request Already Processing');
    return record;
  }

  private replayRecord<T>(record: IdempotencyRedisRecord): Observable<T> {
    if (record.status === 'failed') return throwError(() => this.reconstructError(record.error!));
    return of(record.response as T);
  }

  private reconstructError(error: JsonValue): Error {
    const { message, code } = error as any;
    const err = new IdempotencyException(message, code);
    return err;
  }
}
