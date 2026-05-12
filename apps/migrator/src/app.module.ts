import { validate } from '@app/config';
import { MigrationModule } from '@app/database';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate }), MigrationModule],
})
export class AppModule {}
