import { Injectable } from '@nestjs/common';
import { v4, v7 } from 'uuid';
import { IDGeneratorPort } from '../ports/uuid-generator.port';

@Injectable()
export class IDGeneratorAdapter implements IDGeneratorPort {
  generateUUIDV4(): string {
    return v4();
  }

  generateUUIDV7(): string {
    return v7();
  }
}
