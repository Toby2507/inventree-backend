import { Injectable } from '@nestjs/common';
import { v4, v7 } from 'uuid';
import { UUIDGeneratorPort } from '../ports/uuid-generator.port';

@Injectable()
export class UUIDGeneratorAdapter implements UUIDGeneratorPort {
  generateV4(): string {
    return v4();
  }

  generateV7(): string {
    return v7();
  }
}
