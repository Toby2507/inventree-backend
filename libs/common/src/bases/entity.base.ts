/**
 * Abstract base for all domain entities — both aggregate roots and
 * non-root entities (e.g. line items, lot allocations).
 *
 * Subclasses MUST implement:
 *   - static create(props)       — constructs a new entity, runs invariant checks
 *   - static reconstitute(props) — rehydrates from a DB snapshot, skips validation
 *   - toSnapshot()               — returns a plain serialisable snapshot
 *
 * Static factories cannot be abstract in TypeScript — enforced by convention
 * and verified in code review.
 */
export abstract class BaseEntity<TSnapshot> {
  abstract toSnapshot(): TSnapshot;
}
