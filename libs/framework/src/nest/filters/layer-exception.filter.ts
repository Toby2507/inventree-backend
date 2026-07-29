import { LOGGER, type Logger } from '@app/core/observability';
import { ApplicationException, DomainException, EXCEPTION_CATEGORIES } from '@app/shared-kernel';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import type { Response } from 'express';
import { mapExceptionCategoryToStatus } from '../utils';

@Catch(ApplicationException, DomainException)
export class LayerExceptionFilter implements ExceptionFilter {
  private readonly logger;

  constructor(@Inject(LOGGER) logger: Logger) {
    this.logger = logger.forContext(LayerExceptionFilter.name);
  }

  catch(exception: DomainException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const category = exception.category;
    const status = mapExceptionCategoryToStatus(category);

    if (status === HttpStatus.INTERNAL_SERVER_ERROR && category !== EXCEPTION_CATEGORIES.INTERNAL) {
      this.logger.error(`Unhandled exception category: ${String(category)}`, { exception });
    }

    response.status(status).json({
      statusCode: status,
      code: exception.code,
      message: exception.message,
    });
  }
}
