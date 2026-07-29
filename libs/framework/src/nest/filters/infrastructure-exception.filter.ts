import { LOGGER, type Logger } from '@app/core/observability';
import { InfrastructureException } from '@app/shared-kernel';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Inject,
} from '@nestjs/common';

@Catch(InfrastructureException)
export class InfrastructureExceptionFilter implements ExceptionFilter {
  private readonly logger;

  constructor(@Inject(LOGGER) logger: Logger) {
    this.logger = logger.forContext(InfrastructureExceptionFilter.name);
  }

  catch(exception: InfrastructureException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    this.logger.error(exception.message, { exception, stack: exception.stack });

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: exception.code,
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
}
