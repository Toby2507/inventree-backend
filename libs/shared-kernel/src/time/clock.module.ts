import { Global, Module } from '@nestjs/common';
import { SystemClockAdapter } from './adapters/system-clock.adapter';
import { CLOCK } from './ports/clock.port';

@Global()
@Module({
  providers: [{ provide: CLOCK, useClass: SystemClockAdapter }],
  exports: [CLOCK],
})
export class ClockModule {}
