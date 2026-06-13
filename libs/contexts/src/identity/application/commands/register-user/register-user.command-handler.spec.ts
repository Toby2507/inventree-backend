import { ID_GENERATOR } from '@app/core/generators';
import { DATABASE_CONTEXT } from '@app/database';
import { faker } from '@app/testing';
import { makeIDGeneratorMock } from '@app/testing/core/generators';
import { makeArgon2HasherMock, makeUserRepositoryMock } from '@app/testing/identity';
import { makeDatabaseContextMock } from '@app/testing/system';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../../../domain/user/aggregates/user.aggregate';
import { UserRegisteredEvent } from '../../../domain/user/events/user-registered.event';
import { UserEmailAlreadyExistsException } from '../../../domain/user/exceptions/registration.exceptions';
import { USER_REPOSITORY } from '../../../domain/user/ports/repositories/user.repository';
import { HASHING } from '../../ports/hashing.port';
import { RegisterUserCommand } from './register-user.command';
import { RegisterUserCommandHandler } from './register-user.command-handler';

describe('RegisterUserCommandHandler', () => {
  let module: TestingModule;
  let handler: RegisterUserCommandHandler;

  const argon2Hasher = makeArgon2HasherMock();
  const dbContext = makeDatabaseContextMock();
  const idGenerator = makeIDGeneratorMock();
  const userRepository = makeUserRepositoryMock();

  const command = new RegisterUserCommand({
    email: faker.internet.email(),
    password: faker.internet.password(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    displayName: faker.person.fullName(),
  });

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        RegisterUserCommandHandler,
        { provide: HASHING, useValue: argon2Hasher },
        { provide: USER_REPOSITORY, useValue: userRepository },
        { provide: ID_GENERATOR, useValue: idGenerator },
        { provide: DATABASE_CONTEXT, useValue: dbContext },
      ],
    }).compile();
    await module.init();
    handler = module.get(RegisterUserCommandHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    idGenerator.generateUUIDV7.mockReturnValue(faker.string.uuid());
    argon2Hasher.hash.mockResolvedValue(faker.string.alphanumeric(32));
    userRepository.existsByEmail.mockResolvedValue(false);
  });

  afterAll(async () => {
    jest.clearAllMocks();
    await module.close();
  });

  it('should check if email is already registered', async () => {
    await handler.execute(command);
    expect(dbContext.platformQuery).toHaveBeenCalled();
    expect(userRepository.existsByEmail).toHaveBeenCalledWith(
      expect.anything(),
      command.props.email,
    );
  });

  it('should throw if email already exists', async () => {
    userRepository.existsByEmail.mockResolvedValueOnce(true);
    await expect(handler.execute(command)).rejects.toThrow(UserEmailAlreadyExistsException);
    expect(dbContext.platformQuery).toHaveBeenCalledWith(expect.any(Function));
    expect(userRepository.create).not.toHaveBeenCalled();
  });

  it('should register a new user successfully', async () => {
    await handler.execute(command);
    expect(idGenerator.generateUUIDV7).toHaveBeenCalled();
    expect(argon2Hasher.hash).toHaveBeenCalledWith(command.props.password);
    expect(dbContext.platformCommand).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should persist a valid user inside transactional context', async () => {
    await handler.execute(command);
    expect(userRepository.create).toHaveBeenCalledTimes(1);
    expect(userRepository.create).toHaveBeenCalledWith(expect.anything(), expect.any(User));
    const [ctx, user] = userRepository.create.mock.calls[0];
    expect(ctx).toBeDefined();
    expect(user).toBeInstanceOf(User);
    expect(user.toSnapshot().email).toBe(command.props.email.trim().toLowerCase());
  });

  it('should emit user domain event inside transactional context', async () => {
    await handler.execute(command);
    expect(dbContext.events.emit).toHaveBeenCalledTimes(1);
    expect(dbContext.events.emit).toHaveBeenCalledWith(expect.any(UserRegisteredEvent));
  });
});
