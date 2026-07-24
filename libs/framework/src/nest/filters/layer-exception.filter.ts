import {
  ApplicationException,
  DomainException,
  ExceptionCategory,
  InfrastructureException,
} from '@app/shared-kernel';
import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Inject } from '@nestjs/common';
import { Response } from 'express';
import { mapExceptionCategoryToStatus } from '../utils';
import { LOGGER, LoggerPort } from '@app/core/observability';

@Catch(ApplicationException, DomainException, InfrastructureException)
export class LayerExceptionFilter implements ExceptionFilter {
  private readonly logger;

  constructor(@Inject(LOGGER) logger: LoggerPort) {
    this.logger = logger.forContext(LayerExceptionFilter.name);
  }

  catch(exception: DomainException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const category = exception.category;
    const status = mapExceptionCategoryToStatus(category);

    if (status === HttpStatus.INTERNAL_SERVER_ERROR && category !== ExceptionCategory.INTERNAL) {
      this.logger.error(`Unhandled exception category: ${String(category)}`, { exception });
    }

    response.status(status).json({
      statusCode: status,
      code: exception.code,
      message: exception.message,
    });
  }
}
