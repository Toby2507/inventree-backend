import { DomainEvent } from '@app/common/bases';
import { faker } from '@app/testing';

export interface FDEventPayload {
  value: string;
}

export class FDEvent extends DomainEvent<FDEventPayload> {
  static readonly EVENT_TYPE = faker.word.words(3).replace(/\s/g, '.').toLowerCase();

  readonly eventType = FDEvent.EVENT_TYPE;
  readonly aggregateType = faker.word.noun();

  constructor(public readonly payload: { value: string }) {
    super(faker.string.uuid());
  }
}
