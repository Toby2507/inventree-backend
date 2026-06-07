import { IDEMPOTENCY_HEADER } from '@app/common/constants';
import { mapCodeToStatus } from '@app/common/exceptions';
import { JsonValue } from '@app/common/types';
import { REDIS, RedisPort } from '@app/core/infrastructure/redis';
import { ObfuscationPort } from '@app/core/security';
import { DATABASE_CONTEXT, DatabaseContextPort } from '@app/database';
import {
  BadRequestException,
  CallHandler,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, catchError, defer, from, of, throwError } from 'rxjs';
import { map, mergeMap, switchMap } from 'rxjs/operators';
import { IdempotencyOptions } from '../decorators/idempotency.decorator';
import { IdempotencyException } from '../exceptions/idempotency.exception';
import {
  CreateIdempotencyResult,
  IdempotencyRecord,
} from '../persistence/idempotency.persistence.types';
import { IDEMPOTENCY_REPOSITORY, IdempotencyRepository } from '../persistence/idempotency.port';
import { IdempotencyStrategy } from './interface';
import { OBFUSCATION } from '@app/core/security/ports/obfuscation.port';

@Injectable()
export class DurableIdempotencyStrategy implements IdempotencyStrategy {
  private readonly TTL_SECONDS = 86_400; // 24 hours

  constructor(
    @Inject(REDIS) private readonly redis: RedisPort,
    @Inject(OBFUSCATION) private readonly obfuscation: ObfuscationPort,
    @Inject(DATABASE_CONTEXT) private readonly db: DatabaseContextPort,
    @Inject(IDEMPOTENCY_REPOSITORY) private readonly repository: IdempotencyRepository,
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
      const ttl = options.ttlSeconds ?? this.TTL_SECONDS;
      const createResult = await this.createRecord(key, options.scope, hash, ttl);
      if (createResult.created) {
        return next.handle().pipe(
          switchMap((response) =>
            from(this.markCompleted(key, options.scope, response)).pipe(map(() => response)),
          ),
          catchError((err) => {
            if (this.isDeterministicError(err)) {
              const errorPayload = {
                message: err.message,
                code: err.code,
                status: err.status ?? err.getStatus?.(),
                name: err.name,
              };
              return from(this.markFailed(key, options.scope, errorPayload)).pipe(
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
    }).pipe(switchMap((obs) => obs));
  }

  private async getRecord(key: string, scope: string): Promise<IdempotencyRecord | null> {
    const result = await this.redis.get(this.getRedisKey(key, scope));
    if (result) return result;
    return this.db.platformQuery(async (ctx) =>
      this.repository.findActiveRecord(ctx.operational, key, scope),
    );
  }

  private async createRecord(
    key: string,
    scope: string,
    hash: string,
    ttl: number,
  ): Promise<CreateIdempotencyResult> {
    const record = { key, scope: scope, hash, ttl };
    return this.db.platformCommand(async (ctx) => this.repository.create(ctx.operational, record));
  }

  private async deleteRecord(key: string, scope: string): Promise<void> {
    await this.db.platformCommand(async (ctx) =>
      this.repository.deleteRecord(ctx.operational, key, scope),
    );
    await this.redis.del(this.getRedisKey(key, scope));
  }

  private async markCompleted(key: string, scope: string, response: JsonValue): Promise<void> {
    const record = await this.db.platformCommand(async (ctx) =>
      this.repository.markCompleted(ctx.operational, key, scope, response),
    );
    if (record)
      await this.redis.set(
        this.getRedisKey(key, scope),
        record,
        this.getRemainingTtl(record.expiresAt),
      );
  }

  private async markFailed(key: string, scope: string, error: JsonValue): Promise<void> {
    const record = await this.db.platformCommand(async (ctx) =>
      this.repository.markFailed(ctx.operational, key, scope, error),
    );
    if (record)
      await this.redis.set(
        this.getRedisKey(key, scope),
        record,
        this.getRemainingTtl(record.expiresAt),
      );
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

  private resolveExistingRecord(record: IdempotencyRecord, hash: string): IdempotencyRecord {
    if (record.requestHash !== hash) throw new BadRequestException('Payload mismatch');
    if (record.status === 'in_progress') throw new ConflictException('Request Already Processing');
    return record;
  }

  private replayRecord<T>(record: IdempotencyRecord): Observable<T> {
    if (record.status === 'failed') return throwError(() => this.reconstructError(record.error));
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
