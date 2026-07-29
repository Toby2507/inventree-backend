import { createHandlerDecorator, DiscoveryRegistry } from '@app/framework/nest/discovery';
import { Injectable } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { EMAIL_JOB_HANDLER, type EmailJob, type EmailJobHandler } from './email.interfaces';

export const EmailHandler = createHandlerDecorator<EmailJob>(EMAIL_JOB_HANDLER);

@Injectable()
export class EmailRegistry extends DiscoveryRegistry<EmailJob, EmailJobHandler> {
  constructor(discovery: DiscoveryService, reflector: Reflector) {
    super(EMAIL_JOB_HANDLER, discovery, reflector);
  }
}
