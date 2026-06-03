import { Global, Module } from '@nestjs/common';
import { ObfuscationAdapter } from './adapters/obfuscation.adapter';
import { OBFUSCATION_PORT } from './ports/obfuscation.port';

@Global()
@Module({
  providers: [{ provide: OBFUSCATION_PORT, useClass: ObfuscationAdapter }],
  exports: [OBFUSCATION_PORT],
})
export class SecurityModule {}
