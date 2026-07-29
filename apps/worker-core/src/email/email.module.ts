import { EmailModule } from '@app/core/infrastructure/email';
import { Module } from '@nestjs/common';
import { EmailProcessor } from './email.processor';

@Module({
  imports: [EmailModule],
  providers: [EmailProcessor],
})
export class EmailProcessorModule {}
