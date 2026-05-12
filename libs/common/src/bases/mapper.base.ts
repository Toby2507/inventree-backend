export abstract class Mapper<TDomain, TPersistence, TCreate = TPersistence> {
  abstract toDomain(data: TPersistence): TDomain;

  abstract toPersistence(domain: TDomain): TCreate;

  toDomainBulk(data: TPersistence[] = []): TDomain[] {
    return data.map((item) => this.toDomain(item));
  }

  toPersistenceBulk(domains: TDomain[] = []): TCreate[] {
    return domains.map((item) => this.toPersistence(item));
  }
}
