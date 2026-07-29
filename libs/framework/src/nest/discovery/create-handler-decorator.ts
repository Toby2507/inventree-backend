import { SetMetadata } from '@nestjs/common';

export const createHandlerDecorator = <T>(metadataKey: symbol) => {
  return (job: T) => SetMetadata(metadataKey, job);
};
