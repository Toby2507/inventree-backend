import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { HashingPort } from '../../../application/ports/hashing.port';

@Injectable()
export class Argon2HashingAdapter implements HashingPort {
  async hash(value: string): Promise<string> {
    return argon2.hash(value);
  }

  async compare(value: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, value);
  }
}
