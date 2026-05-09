import { DatabaseContextService } from '@app/database';
import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  User,
  USER_REPOSITORY,
  UserEmailAlreadyExistsException,
  UserRepository,
} from '../../../domain';
import { HASHING_PORT, HashingPort } from '../../ports';
import { RegisterUserCommand } from './register-user.command';

@CommandHandler(RegisterUserCommand)
export class RegisterUserCommandHandler implements ICommandHandler<RegisterUserCommand> {
  constructor(
    @Inject(HASHING_PORT) private readonly hashingPort: HashingPort,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    private readonly db: DatabaseContextService,
  ) {}

  async execute(command: RegisterUserCommand): Promise<void> {
    const { id, email, password, firstName, lastName, displayName } = command.props;
    await this.ensureUserCanRegister(email);
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
