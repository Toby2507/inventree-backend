import { Mapper } from './mapper.base';

interface TestDomain {
  userId: string;
  userName: string;
}
interface TestRow {
  user_id: string;
  user_name: string;
}
class TestMapper extends Mapper<TestDomain, TestRow> {
  toDomain(data: TestRow): TestDomain {
    return {
      userId: data.user_id,
      userName: data.user_name,
    };
  }

  toPersistence(domain: TestDomain): TestRow {
    return {
      user_id: domain.userId,
      user_name: domain.userName,
    };
  }
}

describe('Mapper Abstract Class', () => {
  let mapper: TestMapper;
  beforeEach(() => {
    mapper = new TestMapper();
  });

  describe('toDomainBulk()', () => {
    it('should map an array of rows to an array of domain objects', () => {
      const rows: TestRow[] = [
        { user_id: '1', user_name: 'Alice' },
        { user_id: '2', user_name: 'Bob' },
      ];
      const domains = mapper.toDomainBulk(rows);
      expect(domains).toHaveLength(2);
      expect(domains[0]).toEqual({ userId: '1', userName: 'Alice' });
      expect(domains[1]).toEqual({ userId: '2', userName: 'Bob' });
    });

    it('should return an empty array if given an empty array', () => {
      const domains = mapper.toDomainBulk([]);
      expect(domains).toEqual([]);
    });
  });

  describe('toPersistenceBulk()', () => {
    it('should map an array of domain objects to an array of rows', () => {
      const domains: TestDomain[] = [
        { userId: '1', userName: 'Alice' },
        { userId: '2', userName: 'Bob' },
      ];
      const rows = mapper.toPersistenceBulk(domains);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({ user_id: '1', user_name: 'Alice' });
      expect(rows[1]).toEqual({ user_id: '2', user_name: 'Bob' });
    });

    it('should return an empty array if given an empty array', () => {
      const rows = mapper.toPersistenceBulk([]);
      expect(rows).toEqual([]);
    });
  });
});
