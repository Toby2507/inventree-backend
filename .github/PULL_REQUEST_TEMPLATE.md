## Description

Brief summary of changes

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Refactoring (no functional changes)
- [ ] Documentation update

## Related Issues

Closes #123
Related to #456

## Changes Made

- Added user registration flow
- Implemented email verification
- Created UserAggregate with business logic
- Added unit tests for User domain

## Architecture Impact

- Added new bounded context: IAM
- Introduced CQRS pattern with commands and queries
- Implemented domain events for user registration

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

### Test Cases

- [x] User can register with valid credentials
- [x] Registration fails with invalid email
- [x] Email verification token is sent
- [x] User cannot login before email verification

## Database Changes

- [ ] Migrations added
- [ ] Migrations tested locally
- [ ] Rollback plan documented

### Migration Details

```sql
-- Added users table
-- Added user_security table
-- Added user_preferences table
```

## Breaking Changes

None / List any breaking changes

## Checklist

- [ ] Code follows style guide
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] Tests added and passing
- [ ] No console logs or debugging code
- [ ] Branch is up to date with main

## Screenshots (if applicable)

N/A

## Additional Notes

Any additional context or information
