import { Injectable } from '@nestjs/common';
import { v4, v7 } from 'uuid';
import { UUIDGeneratorPort } from '../ports';

@Injectable()
export class UUIDGeneratorAdapter implements UUIDGeneratorPort {
  generateV4(): string {
    return v4();
  }

  generateV7(): string {
    return v7();
  }
}
