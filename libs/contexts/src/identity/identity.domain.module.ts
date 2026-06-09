import { Module } from '@nestjs/common';
import { RegisterUserCommandHandler } from './application/commands/register-user/register-user.command-handler';
import { HASHING } from './application/ports/hashing.port';
import { USER_REPOSITORY } from './domain/user/ports/repositories/user.repository';
import { UserKyselyRepository } from './infrastructure/persistence/repositories/user.kysely.repository';
import { Argon2HashingAdapter } from './infrastructure/security/hashing/argon2.hashing.adapter';

@Module({
  providers: [
    RegisterUserCommandHandler,
    { provide: HASHING, useClass: Argon2HashingAdapter },
    { provide: USER_REPOSITORY, useClass: UserKyselyRepository },
  ],
})
export class IdentityDomainModule {}
