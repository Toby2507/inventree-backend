import { Global, Module } from '@nestjs/common';
import { UUIDGeneratorAdapter } from './adapters';
import { UUID_GENERATOR_PORT } from './ports';

@Global()
@Module({
  providers: [{ provide: UUID_GENERATOR_PORT, useClass: UUIDGeneratorAdapter }],
  exports: [UUID_GENERATOR_PORT],
})
export class GeneratorModule {}
