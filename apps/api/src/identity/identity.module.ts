import { IdentityDomainModule } from '@app/contexts/identity';
import { Module } from '@nestjs/common';
import { AuthController } from './controllers/auth.controller';

@Module({
  imports: [IdentityDomainModule],
  controllers: [AuthController],
})
export class IdentityModule {}
