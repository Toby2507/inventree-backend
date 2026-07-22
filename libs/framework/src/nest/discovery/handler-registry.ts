import { OnModuleInit } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';

export abstract class DiscoveryRegistry<TKey, THandler> implements OnModuleInit {
  protected readonly handlers = new Map<TKey, THandler>();

  protected constructor(
    private readonly metadataKey: symbol,
    protected readonly discovery: DiscoveryService,
    protected readonly reflector: Reflector,
  ) {}

  onModuleInit() {
    for (const wrapper of this.discovery.getProviders()) {
      const { instance, metatype } = wrapper;
      if (!instance || !metatype) continue;
      const key = this.reflector.get<TKey>(this.metadataKey, metatype);
      if (!key) continue;
      this.handlers.set(key, instance as THandler);
    }
  }

  get(key: TKey): THandler | undefined {
    return this.handlers.get(key);
  }
}
