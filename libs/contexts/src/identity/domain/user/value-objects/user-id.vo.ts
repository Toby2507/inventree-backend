import { BaseUUID } from '@app/common/bases';

export class UserID extends BaseUUID {
  private constructor(value: string) {
    super(value);
  }

  static from(value: string): UserID {
    return new UserID(value);
  }
}
