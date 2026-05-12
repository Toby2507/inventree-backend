import { Module } from '@nestjs/common';
import { RegisterUserCommandHandler } from './application/commands/register-user/register-user.command-handler';
import { HASHING_PORT } from './application/ports';
import { USER_REPOSITORY } from './domain';
import { Argon2HashingAdapter } from './infrastructure';
import { UserKyselyRepository } from './infrastructure/persistence/repositories';

@Module({
  providers: [
    RegisterUserCommandHandler,
    { provide: HASHING_PORT, useClass: Argon2HashingAdapter },
    { provide: USER_REPOSITORY, useClass: UserKyselyRepository },
  ],
})
export class IdentityDomainModule {}
