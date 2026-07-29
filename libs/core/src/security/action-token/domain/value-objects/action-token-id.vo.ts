import { BaseUUID } from '@app/shared-kernel';

export class ActionTokenID extends BaseUUID {
  private constructor(value: string) {
    super(value);
  }

  static from(value: string): ActionTokenID {
    return new ActionTokenID(value);
  }
}
