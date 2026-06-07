import { Global, Module } from '@nestjs/common';
import { ObfuscationAdapter } from './adapters/obfuscation.adapter';
import { OBFUSCATION } from './ports/obfuscation.port';

@Global()
@Module({
  providers: [{ provide: OBFUSCATION, useClass: ObfuscationAdapter }],
  exports: [OBFUSCATION],
})
export class SecurityModule {}
