# Git Style Guide — InvenTree

## Strategy

- **Flow:** Trunk Based Development. Branch from `main`, squash merge back.
- **Main branch:** `main` (protected — no direct push)
- **Merge strategy:** Squash merge only. Linear history enforced.

---

## Branch Names

```
<type>/<ticket-number>-<short-description>
```

Ticket number is a global sequential integer (zero-padded to 3 digits):

```bash
feat/001-database-foundation
fix/002-tenant-rls-policies
chore/003-kysely-codegen-types
test/004-database-library-tests
```

**Types:** `feat` `fix` `chore` `test` `refactor` `docs` `ci`  
Lowercase, hyphens only, no special characters.

---

## Commit Format

Conventional Commits. Scope = bounded context or infrastructure concern.

```
<type>(<scope>): <subject>
```

**InvenTree scopes:**

```
identity        store-config    catalog         inventory
pos             purchasing      notifications   billing
database        analytics       ci              config
platform        core            deps            security
```

`database` — migrations, Kysely, connection pooling  
`platform` — outbox, audit, eventing, media, mailing, reporting infrastructure  
`core` — shared kernel (base entities, value objects, domain event base types)
`deps` — dependency updates  
`security` — security patches and updates

**Layered scopes (optional, for granular history):**

```
feat(pos/domain): add transaction aggregate with completion logic
feat(pos/application): implement complete transaction command handler
feat(pos/infrastructure): add kysely transaction repository
feat(pos): add pos module — wires domain, application, and infrastructure
```

**Rules:**

- Subject: lowercase, imperative mood, no period, max 72 chars
- Body: explain _why_, not _what_ — wrap at 72 chars
- No vague messages: `fix bug`, `update files`, `wip` are rejected

**Examples:**

```bash
# ✅
feat(catalog): add product variant option assignments migration
fix(database): use process.env directly in DatabaseService
chore(inventory): add inventory movements immutable ledger migration
test(database): add unit and integration tests for database library
ci: add summary jobs to test and build workflows for branch protection

# ❌
updated migrations
fixed the thing
feat: add stuff
```

---

## PR Workflow

```
Create branch from main
  → write code
  → pnpm migrate:test (if migrations changed)
  → push → open as draft PR
  → mark ready for review when complete
  → squash merge to main
```

**PR title** = same format as commit message.  
**Commit grouping:** Group by bounded context, not by file. One commit per context per PR.

```bash
# ✅ — one commit per logical unit
chore(database): add identity and store config context migrations
chore(database): add catalog context migrations
chore(database): generate kysely types from schema

# ❌ — one commit per file
chore(database): add users migration
chore(database): add user_security migration
chore(database): add businesses migration
```

---

## Branch Protection (main)

Required status checks before merge:

- `Validate and Lint / validate`
- `Build / all-builds-passed`
- `Test / all-tests-passed`

Linear history enforced. No bypass allowed.

---

## Pre-commit Checklist

Before every commit:

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm migrate:test` passes (if migrations changed)
- [ ] No `console.log` or debug code
- [ ] No `gen_random_uuid()` — use `uuidv7()`
