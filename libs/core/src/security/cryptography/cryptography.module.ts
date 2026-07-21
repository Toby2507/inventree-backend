import { securityConfig } from '@app/config';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CryptographyAdapter } from './cryptography.adapter';
import { CRYPTOGRAPHY } from './cryptography.port';

@Module({
  imports: [ConfigModule.forFeature(securityConfig)],
  providers: [{ provide: CRYPTOGRAPHY, useClass: CryptographyAdapter }],
  exports: [CRYPTOGRAPHY],
})
export class CryptographyModule {}
