import { CallHandler, ExecutionContext, NestInterceptor, UseInterceptors } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { map, Observable } from 'rxjs';

export interface ClassConstructor<T = any> {
  new (...args: unknown[]): T;
}

export function Serialize(dto: ClassConstructor) {
  return UseInterceptors(new SerializerInterceptor(dto));
}

export class SerializerInterceptor implements NestInterceptor {
  constructor(private readonly dto: ClassConstructor) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((response: unknown) => {
        if (!response || typeof response !== 'object') return response;
        const res = response as Record<string, unknown>;
        if (!('data' in res)) return response;
        return { ...res, data: this.transformData(res.data) };
      }),
    );
  }

  private transformData(data: unknown) {
    if (data == null || typeof data !== 'object') return data;
    if (Array.isArray(data)) {
      return data.map((item) => plainToInstance(this.dto, item, { excludeExtraneousValues: true }));
    }
    return plainToInstance(this.dto, data, { excludeExtraneousValues: true });
  }
}
