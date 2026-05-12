import { IdentityDomainModule } from '@app/contexts';
import { Module } from '@nestjs/common';
import { AuthController } from './controllers';

@Module({
  imports: [IdentityDomainModule],
  controllers: [AuthController],
})
export class IdentityModule {}
