import { Global, Module } from '@nestjs/common';
import { UUIDGeneratorAdapter } from './adapters/uuid-generator.adapter';
import { UUID_GENERATOR_PORT } from './ports/uuid-generator.port';

@Global()
@Module({
  providers: [{ provide: UUID_GENERATOR_PORT, useClass: UUIDGeneratorAdapter }],
  exports: [UUID_GENERATOR_PORT],
})
export class GeneratorModule {}
