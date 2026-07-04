export abstract class BaseEntity<TSnapshot> {
  abstract toSnapshot(): TSnapshot;
}

export interface EntityConstructor<T, CreateProps, Snapshot> {
  create(props: CreateProps): T;
  reconstitute(snapshot: Snapshot): T;
}
