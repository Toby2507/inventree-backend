import { Injectable } from '@nestjs/common';
import { v4, v7 } from 'uuid';
import type { IDGeneratorPort } from '../ports/id-generator.port.js';

@Injectable()
export class IDGeneratorAdapter implements IDGeneratorPort {
  generateUUIDV4(): string {
    return v4();
  }

  generateUUIDV7(): string {
    return v7();
  }
}
