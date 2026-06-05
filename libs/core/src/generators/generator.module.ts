import { Global, Module } from '@nestjs/common';
import { IDGeneratorAdapter } from './adapters/uuid-generator.adapter';
import { ID_GENERATOR_PORT } from './ports/uuid-generator.port';

@Global()
@Module({
  providers: [{ provide: ID_GENERATOR_PORT, useClass: IDGeneratorAdapter }],
  exports: [ID_GENERATOR_PORT],
})
export class GeneratorModule {}
