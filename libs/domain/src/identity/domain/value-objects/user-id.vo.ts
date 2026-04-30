import { BaseUUID } from '@app/common';

export class UserID extends BaseUUID {
  private constructor(value: string) {
    super(value);
  }

  static from(value: string): UserID {
    return new UserID(value);
  }
}
