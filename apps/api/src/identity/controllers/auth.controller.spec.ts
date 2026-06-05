import { RegisterUserCommand } from '@app/contexts/identity';
import { makeCommandBusMock } from '@app/testing/system';
import { faker } from '@app/testing/utils';
import { CommandBus } from '@nestjs/cqrs';
import { Test, TestingModule } from '@nestjs/testing';
import { RegisterUserDTO } from '../dtos/input/user.dtos';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  let module: TestingModule;
  let controller: AuthController;

  const commandBus = makeCommandBusMock();

  beforeAll(async () => {
    module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: CommandBus, useValue: commandBus }],
    }).compile();
    await module.init();
    controller = module.get<AuthController>(AuthController);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    jest.clearAllMocks();
    await module.close();
  });

  describe('AuthController.register()', () => {
    const body: RegisterUserDTO = {
      email: faker.internet.email(),
      password: faker.internet.password(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      displayName: faker.person.fullName(),
    };

    it('should dispatch a RegisterUserCommand with the provided body to the command bus', async () => {
      await controller.register(body);
      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      expect(commandBus.execute).toHaveBeenCalledWith(expect.any(RegisterUserCommand));
      const [command] = commandBus.execute.mock.calls[0];
      expect(command).toBeInstanceOf(RegisterUserCommand);
      expect(command.props).toEqual(body);
    });

    it('should return a success response', async () => {
      const result = await controller.register(body);
      expect(result).toEqual({ code: 'SUCCESS', message: 'User registered successfully' });
    });
  });
});
