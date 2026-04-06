import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { Response } from 'express';
import { DomainException, mapCodeToStatus } from '../exceptions';

@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: DomainException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = mapCodeToStatus(exception.code);

    if (exception.context) {
      this.logger.warn(`[${exception.code}] ${exception.message}`, exception.context);
    }

    response.status(status).json({
      statusCode: status,
      code: exception.code,
      message: exception.message,
    });
  }
}
