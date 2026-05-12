import { ControllerResponse } from '@app/common';
import { RegisterUserCommand } from '@app/contexts';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RegisterUserDTO } from '../dtos';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new account',
    description: 'Creates a pending user account and initiates the account activation workflow.',
  })
  @ApiBadRequestResponse({ description: 'Invalid request data' })
  @ApiCreatedResponse({ description: 'User registered successfully' })
  @ApiConflictResponse({ description: 'Email already in use' })
  async register(@Body() body: RegisterUserDTO): ControllerResponse {
    await this.commandBus.execute(new RegisterUserCommand(body));
    return { code: 'SUCCESS', message: 'User registered successfully' };
  }
}
