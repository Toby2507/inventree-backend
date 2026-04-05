# Style Guide — InvenTree

## File Naming

| Artifact               | Convention                          | Example                                   |
| ---------------------- | ----------------------------------- | ----------------------------------------- |
| All files              | kebab-case                          | `complete-transaction.handler.ts`         |
| Migrations             | `<timestamp>_<snake_name>.ts`       | `1741234567890_users.ts`                  |
| Entity                 | `<name>.entity.ts`                  | `transaction.entity.ts`                   |
| Aggregate Root         | `<name>.aggregate.ts`               | `transaction.aggregate.ts`                |
| Value object           | `<name>.value-object.ts`            | `money.value-object.ts`                   |
| Domain event           | `<subject-past-tense>.event.ts`     | `transaction-completed.event.ts`          |
| Domain service         | `<action>-<subject>.service.ts`     | `calculate-inventory.service.ts`          |
| Repository interface   | `<name>.repository.ts`              | `transaction.repository.ts`               |
| Repository impl        | `<name>.<tech>.repository.ts`       | `transaction.kysely.repository.ts`        |
| Command                | `<verb-subject>.command.ts`         | `complete-transaction.command.ts`         |
| Command handler        | `<verb-subject>.command-handler.ts` | `complete-transaction.command-handler.ts` |
| Query                  | `<verb-subject>.query.ts`           | `find-transaction.query.ts`               |
| Query handler          | `<verb-subject>.query-handler.ts`   | `find-transaction.query-handler.ts`       |
| Read model             | `<subject>.read-model.ts`           | `transaction.read-model.ts`               |
| ACL port               | `<subject>.port.ts`                 | `product-catalog.port.ts`                 |
| ACL adapter            | `<subject>.<context>.adapter.ts`    | `product-catalog.pos.adapter.ts`          |
| Resolver               | `<subject>.resolver.ts`             | `product-catalog.resolver.ts`             |
| Policy / Specification | `<rule>.policy.ts`                  | `transaction-completion.policy.ts`        |
| Context module         | `<context>.module.ts`               | `pos.module.ts`                           |
| Domain module          | `<context>.domain.module.ts`        | `pos.domain.module.ts`                    |

---

## TypeScript Naming

| Type                              | Convention                    | Example                                              |
| --------------------------------- | ----------------------------- | ---------------------------------------------------- |
| Classes, interfaces, types, enums | PascalCase                    | `TransactionRepository`                              |
| Interface                         | PascalCase, **no `I` prefix** | `TransactionRepository` not `ITransactionRepository` |
| Enum values                       | `snake_case` string literals  | `'purchase_receipt'` not `PURCHASE_RECEIPT`          |
| Constants / injection tokens      | `SCREAMING_SNAKE_CASE`        | `TRANSACTION_REPOSITORY`                             |
| Variables, params, methods        | camelCase                     | `transactionId`                                      |
| Domain events                     | `<Subject><PastTense>Event`   | `TransactionCompletedEvent`                          |
| Commands                          | `<Verb><Subject>Command`      | `CompleteTransactionCommand`                         |
| Queries                           | `<Get\|List><Subject>Query`   | `GetTransactionQuery`                                |
| Read models                       | `<Subject>ReadModel`          | `TransactionReadModel`                               |

---

## Domain Entity Structure

Private constructor + two static factories + business methods + `toSnapshot()`:

```typescript
export class Transaction {
  private constructor(
    private readonly _id: string,
    private _status: TransactionStatus,
  ) {}

  // New entity — runs validation
  static create(props: CreateTransactionProps): Transaction {
    if (!props.lines.length) throw new TransactionMustHaveLinesException();
    return new Transaction(props.id, 'open');
  }

  // From DB row — skips validation (trust the DB)
  static reconstitute(props: TransactionProps): Transaction {
    return new Transaction(props.id, props.status);
  }

  complete(): void {
    if (this._status !== 'open') throw new TransactionAlreadyCompletedException();
    this._status = 'completed';
  }

  toSnapshot(): TransactionSnapshot {
    return { id: this._id, status: this._status };
  }
}
```

**Rules:**

- Domain objects have zero NestJS decorators, zero Kysely imports.
- Guard methods throw `DomainException` subtypes before every state change — never `HttpException`.
- `toSnapshot()` is required on every entity — used by repositories and outbox and enforced by BaseEntity in `libs/common/src/bases`.
- Static `create()` and `reconstitute()` are required.

---

## Command / Query Structure

```typescript
// command — input shape only, no logic
export class CompleteTransactionCommand {
  constructor(public readonly props: {
    transactionId: string;
    memberId: string;
    storeId: string;
  }) {}
}

// query — input shape only
export class GetTransactionQuery {
  constructor(public readonly props: {
    transactionId: string;
    storeId: string;
  }) {}
}

// read model — flat camelCase DTO, no domain entity
export interface TransactionReadModel {
  @Expose()
  id: string;

  @Expose()
  status: string;

  @Expose()
  totalAmount: number;
}
```

---

## Repository Interface (`domain/ports/repositories/`)

```typescript
// Owned by the domain context, implemented in infrastructure/repositories/
export interface TransactionRepository {
  findById(id: string): Promise<Transaction | null>;
  save(transaction: Transaction): Promise<void>;
}

export const TRANSACTION_REPOSITORY = Symbol('TRANSACTION_REPOSITORY');
```

## ACL Port (`domain/ports/acl/`)

```typescript
// Defines what the consuming context needs — implemented by the owning context
export interface ProductCatalogPort {
  findVariantById(id: string): Promise<ProductVariantDto | null>;
}

export const PRODUCT_CATALOG_PORT = Symbol('PRODUCT_CATALOG_PORT');
```

## Resolver (`infrastructure/resolvers/`)

Direct Kysely read for inter-context data queries where no business rule is enforced:

```typescript
// No port, no adapter — just a query
@Injectable()
export class ProductCatalogResolver {
  constructor(private readonly db: TenantDatabaseService) {}

  async findVariantById(id: string): Promise<ProductVariantDto | null> {
    // direct Kysely query
  }
}
```

---

## Database Naming

| Type           | Convention                   | Example                                      |
| -------------- | ---------------------------- | -------------------------------------------- |
| Tables         | `snake_case`, plural         | `pos_transactions`                           |
| Columns        | `snake_case`                 | `created_at`, `store_id`                     |
| Indexes        | `idx_<table>_<columns>`      | `idx_pos_transactions_store_status_time`     |
| Unique indexes | `ux_<table>_<columns>`       | `ux_pos_transactions_store_receipt_number`   |
| Constraints    | `chk_<table>_<description>`  | `chk_pos_transactions_money_nonnegative`     |
| Triggers       | `trg_set_<table>_updated_at` | `trg_set_pos_transactions_updated_at`        |
| Functions      | `<verb>_<subject>`           | `set_updated_at`, `cascade_user_soft_delete` |
| Enum types     | `<context>_<name>`           | `pos_transaction_status`                     |

---

## Import Order

```typescript
// 1. Node built-ins
import { randomUUID } from 'crypto';

// 2. External packages
import { Injectable } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';

// 3. Monorepo aliases (@app/*)
import { TenantDatabaseService } from '@app/database';
import { OutboxService } from '@app/database';

// 4. Relative — domain layer
import { Transaction } from '../../domain/entities/transaction.entity';

// 5. Relative — ports/interfaces
import {
  TransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../domain/ports/transaction.repository';
```

---

## Outbox Event Type Format

```
<context>.<entity>.<past-tense-verb>

pos.transaction.completed
inventory.stock.low
purchase.order.approved
store.member.invited
```

## Domain Exception Structure

All domain exceptions extend `DomainException` from `libs/common/src/exceptions`. Never extend
`HttpException` — the domain layer has zero HTTP awareness.

```typescript
import { DomainException } from '@app/common';

export class TransactionAlreadyCompletedException extends DomainException {
  readonly code = 'TRANSACTION_ALREADY_COMPLETED';

  constructor() {
    super('Transaction is already completed');
  }
}
```

`DomainExceptionFilter` in `libs/common` catches these at the HTTP boundary and maps
`code` → `HttpStatus` via `mapCodeToStatus`.
