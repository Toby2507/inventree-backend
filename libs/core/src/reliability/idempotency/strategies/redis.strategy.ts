import { IDEMPOTENCY_HEADER, JsonValue, mapCodeToStatus } from '@app/common';
import {
  BadRequestException,
  CallHandler,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, catchError, from, map, mergeMap, of, throwError } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { REDIS, RedisPort } from '../../../infrastructure';
import { OBFUSCATION_PORT, ObfuscationPort } from '../../../security';
import { IdempotencyOptions } from '../decorators/idempotency.decorator';
import { IdempotencyException } from '../exceptions/idempotency.exception';
import { IdempotencyRedisRecord } from '../persistence/idempotency.persistence.types';
import { IdempotencyStrategy } from './interface';

@Injectable()
export class RedisIdempotencyStrategy implements IdempotencyStrategy {
  private readonly TTL_SECONDS = 86_400; // 24 hours

  constructor(
    @Inject(REDIS) private readonly redis: RedisPort,
    @Inject(OBFUSCATION_PORT) private readonly obfuscation: ObfuscationPort,
  ) {}

  handle<T>(request: any, next: CallHandler, options: IdempotencyOptions): Observable<T> {
    return from(this.handleInterval<T>(request, next, options)).pipe(switchMap((obs) => obs));
  }

  private async handleInterval<T>(
    request: Request,
    next: CallHandler,
    options: IdempotencyOptions,
  ): Promise<Observable<T>> {
    const key = request.header(IDEMPOTENCY_HEADER);
    if (!key) throw new BadRequestException('Missing Idempotency-Key');
    const hash = this.obfuscation.hash(request.body);
    const existingRecord = await this.getRecord(key, options.scope);
    if (existingRecord) {
      const record = this.resolveExistingRecord(existingRecord, hash);
      return this.replayRecord<T>(record);
    } else {
      const acquired = await this.createRecord(key, options.scope, hash);
      if (!acquired) {
        return next.handle().pipe(
          switchMap((response) =>
            from(this.markCompleted(key, options.scope, hash, response)).pipe(
              map(() => response as T),
            ),
          ),
          catchError((err) => {
            if (this.isDeterministicError(err)) {
              const errorPayload = {
                message: err.message,
                code: err.code,
                status: err.status ?? err.getStatus?.(),
                name: err.name,
              };
              return from(this.markFailed(key, options.scope, hash, errorPayload)).pipe(
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
        if (!existingRecord) throw new UnprocessableEntityException('Idempotency record not found');
        const record = this.resolveExistingRecord(existingRecord, hash);
        return this.replayRecord<T>(record);
      }
    }
  }

  private async getRecord(key: string, scope: string): Promise<IdempotencyRedisRecord | null> {
    try {
      return this.redis.get<IdempotencyRedisRecord | null>(this.getRedisKey(key, scope));
    } catch {
      throw new ServiceUnavailableException('Idempotency service unavailable');
    }
  }

  private async createRecord(key: string, scope: string, hash: string): Promise<boolean> {
    const record: IdempotencyRedisRecord = { requestHash: hash, status: 'in_progress' };
    const result = await this.redis.setNX(this.getRedisKey(key, scope), record, this.TTL_SECONDS);
    return result === 'OK';
  }

  private async deleteRecord(key: string, scope: string): Promise<void> {
    await this.redis.del(this.getRedisKey(key, scope));
  }

  private async markCompleted(key: string, scope: string, hash: string, response: JsonValue) {
    const record: IdempotencyRedisRecord = { requestHash: hash, status: 'completed', response };
    await this.redis.setNX(this.getRedisKey(key, scope), record, this.TTL_SECONDS);
  }

  private async markFailed(
    key: string,
    scope: string,
    hash: string,
    error: JsonValue,
  ): Promise<void> {
    const record: IdempotencyRedisRecord = { requestHash: hash, status: 'failed', error };
    await this.redis.setNX(this.getRedisKey(key, scope), record, this.TTL_SECONDS);
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

  private getRemainingTtl(expiresAt: Date): number {
    const remainingMs = expiresAt.getTime() - new Date().getTime();
    return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
  }

  private reconstructError(error: JsonValue): Error {
    const { message, code } = error as any;
    const err = new IdempotencyException(message, code);
    return err;
  }
}
