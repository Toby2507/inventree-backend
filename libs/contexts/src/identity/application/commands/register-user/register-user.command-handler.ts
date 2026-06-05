import { ID_GENERATOR_PORT, IDGeneratorPort } from '@app/core/generators';
import { DATABASE_CONTEXT, DatabaseContextPort } from '@app/database';
import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { User } from '../../../domain/user/aggregates/user.aggregate';
import { UserEmailAlreadyExistsException } from '../../../domain/user/exceptions/registration.exceptions';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../../domain/user/ports/repositories/user.repository';
import { HASHING_PORT, HashingPort } from '../../ports/hashing.port';
import { RegisterUserCommand } from './register-user.command';

@CommandHandler(RegisterUserCommand)
export class RegisterUserCommandHandler implements ICommandHandler<RegisterUserCommand> {
  constructor(
    @Inject(HASHING_PORT) private readonly hashingPort: HashingPort,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IDGeneratorPort,
    @Inject(DATABASE_CONTEXT) private readonly db: DatabaseContextPort,
  ) {}

  async execute(command: RegisterUserCommand): Promise<void> {
    const { email, password, firstName, lastName, displayName } = command.props;
    await this.ensureUserCanRegister(email);
    const id = this.idGenerator.generateUUIDV7();
    const passwordHash = await this.hashingPort.hash(password);
    const user = User.create({ id, email, passwordHash, firstName, lastName, displayName });
    await this.db.platformCommand(async (ctx) => {
      await this.userRepository.create(ctx.operational, user);
      // TODO: pull domain events and publish them to the outbox
    });
  }

  private async ensureUserCanRegister(email: string): Promise<void> {
    const inUse = await this.db.platformQuery((ctx) =>
      this.userRepository.existsByEmail(ctx.operational, email),
    );
    if (inUse) throw new UserEmailAlreadyExistsException(email);
  }
}
