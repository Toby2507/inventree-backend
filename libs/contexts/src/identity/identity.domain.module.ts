import { Module } from '@nestjs/common';
import { HASHING_PORT } from './application/ports';
import { Argon2HashingAdapter } from './infrastructure';

@Module({
  providers: [{ provide: HASHING_PORT, useClass: Argon2HashingAdapter }],
})
export class IdentityDomainModule {}
