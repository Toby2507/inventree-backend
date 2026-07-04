import { BaseUUID } from '@app/shared-kernel';

export class UserID extends BaseUUID {
  private constructor(value: string) {
    super(value);
  }

  static from(value: string): UserID {
    return new UserID(value);
  }
}
