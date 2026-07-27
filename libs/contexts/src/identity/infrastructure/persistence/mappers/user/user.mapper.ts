import { Instant, Mapper } from '@app/shared-kernel';
import { User } from '../../../../domain/user/aggregates/user.aggregate';
import { UserSecurityMapper } from './user-security.mapper';
import type { UserPersistence } from './user.persistence.types';

export class UserMapper extends Mapper<User, UserPersistence> {
  private readonly securityMapper = new UserSecurityMapper();

  toDomain(raw: UserPersistence): User {
    const { user, security } = raw;
    return User.reconstitute({
      id: user.id,
      email: user.email,
      emailVerifiedAt: user.email_verified_at ? Instant.fromDate(user.email_verified_at) : null,
      phone: user.phone,
      phoneVerifiedAt: user.phone_verified_at ? Instant.fromDate(user.phone_verified_at) : null,
      passwordHash: user.password_hash,
      firstName: user.first_name,
      lastName: user.last_name,
      displayName: user.display_name,
      status: user.status,
      createdAt: Instant.fromDate(user.created_at),
      deletedAt: user.deleted_at ? Instant.fromDate(user.deleted_at) : null,
      security: this.securityMapper.toDomain(security),
    });
  }

  toPersistence(entity: User): UserPersistence {
    const user = entity.toSnapshot();
    return {
      user: {
        id: user.id,
        email: user.email,
        email_verified_at: user.emailVerifiedAt?.toDate() ?? null,
        phone: user.phone,
        phone_verified_at: user.phoneVerifiedAt?.toDate() ?? null,
        password_hash: user.passwordHash,
        first_name: user.firstName,
        last_name: user.lastName,
        display_name: user.displayName,
        status: user.status,
        created_at: user.createdAt.toDate(),
        deleted_at: user.deletedAt?.toDate() ?? null,
      },
      security: this.securityMapper.toPersistence(user.security),
    };
  }
}
