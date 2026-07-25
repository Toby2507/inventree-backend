import { ID_GENERATOR, type IDGenerator } from '@app/core/generators';
import { DATABASE_CONTEXT, type DatabaseContext } from '@app/database';
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { User } from '../../../domain/user/aggregates/user.aggregate';
import { UserEmailAlreadyExistsException } from '../../../domain/user/exceptions/registration.exceptions';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../../domain/user/ports/repositories/user.repository';
import { HASHING, type Hashing } from '../../ports/hashing.port';
import { RegisterUserCommand } from './register-user.command';

@CommandHandler(RegisterUserCommand)
export class RegisterUserCommandHandler implements ICommandHandler<RegisterUserCommand> {
  constructor(
    @Inject(HASHING) private readonly hasher: Hashing,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(ID_GENERATOR) private readonly idGenerator: IDGenerator,
    @Inject(DATABASE_CONTEXT) private readonly db: DatabaseContext,
  ) {}

  async execute(command: RegisterUserCommand): Promise<void> {
    const { email, password, firstName, lastName, displayName } = command.props;
    await this.ensureUserCanRegister(email);
    const id = this.idGenerator.generateUUIDV7();
    const passwordHash = await this.hasher.hash(password);
    const user = User.create({ id, email, passwordHash, firstName, lastName, displayName });
    await this.db.platformCommand(async (ctx) => {
      await this.userRepository.create(ctx.operational, user);
      ctx.events.emit(...user.pullDomainEvents());
    });
  }

  private async ensureUserCanRegister(email: string): Promise<void> {
    const inUse = await this.db.platformQuery((ctx) =>
      this.userRepository.existsByEmail(ctx.operational, email),
    );
    if (inUse) throw new UserEmailAlreadyExistsException(email);
  }
}
