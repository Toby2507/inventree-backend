import { Global, Module } from '@nestjs/common';
import { IDGeneratorAdapter } from './adapters/id-generator.adapter';
import { ID_GENERATOR } from './ports/id-generator.port';

@Global()
@Module({
  providers: [{ provide: ID_GENERATOR, useClass: IDGeneratorAdapter }],
  exports: [ID_GENERATOR],
})
export class GeneratorModule {}
