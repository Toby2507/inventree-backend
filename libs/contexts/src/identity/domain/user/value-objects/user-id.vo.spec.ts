import { faker } from '@app/testing';
import { UserID } from './user-id.vo';

describe('UserID value object', () => {
  it('should create valid uuid from the from method', () => {
    const uuid = faker.string.uuid();
    const userId = UserID.from(uuid);
    expect(userId.value).toBe(uuid);
  });
});
