import { QueryBuilder, Query } from '../../src/dsl/QueryBuilder';

describe('QueryBuilder', () => {
  const queryId = 'testQuery';

  describe('constructor', () => {
    test('should create a QueryBuilder instance with a valid ID', () => {
      const qb = new QueryBuilder(queryId);
      expect(qb).toBeInstanceOf(QueryBuilder);
      expect(qb.query.id).toBe(queryId);
      expect(qb.query.when).toEqual([]);
      expect(qb.query.type).toBe('query');
    });

    test('should throw an error if ID is not a non-empty string', () => {
      expect(() => new QueryBuilder('')).toThrow('QueryBuilder: Query ID must be a non-empty string.');
      expect(() => new QueryBuilder('   ')).toThrow('QueryBuilder: Query ID must be a non-empty string.');
      expect(() => new QueryBuilder(null)).toThrow('QueryBuilder: Query ID must be a non-empty string.');
      expect(() => new QueryBuilder(undefined)).toThrow('QueryBuilder: Query ID must be a non-empty string.');
      expect(() => new QueryBuilder(123)).toThrow('QueryBuilder: Query ID must be a non-empty string.');
    });
  });

  describe('when()', () => {
    let qb;
    beforeEach(() => {
      qb = new QueryBuilder(queryId);
    });

    test('should add a single condition', () => {
      const condition = { type: 'user', status: 'active' };
      qb.when(condition);
      expect(qb.query.when).toEqual([condition]);
    });

    test('should add multiple conditions', () => {
      const condition1 = { type: 'user', status: 'active' };
      const condition2 = { type: 'order', amount: { _gt: 100 } };
      qb.when(condition1, condition2);
      expect(qb.query.when).toEqual([condition1, condition2]);
    });

    test('should append conditions on multiple calls', () => {
      const condition1 = { type: 'user' };
      const condition2 = { type: 'product' };
      qb.when(condition1).when(condition2);
      expect(qb.query.when).toEqual([condition1, condition2]);
    });

    test('should return the builder instance for chaining', () => {
      const condition = { type: 'user' };
      expect(qb.when(condition)).toBe(qb);
    });
  });

  describe('select()', () => {
    let qb;
    beforeEach(() => {
      qb = new QueryBuilder(queryId);
    });

    test('should set the projection object', () => {
      const projection = { name: '?userName', id: '?userId' };
      qb.select(projection);
      expect(qb.query.select).toEqual(projection);
    });

    test('should throw TypeError if projection is not an object', () => {
      expect(() => qb.select(null)).toThrow(TypeError);
      expect(() => qb.select(undefined)).toThrow(TypeError);
      expect(() => qb.select('string')).toThrow(TypeError);
      expect(() => qb.select(123)).toThrow(TypeError);
    });

    test('should return the builder instance for chaining', () => {
      const projection = { name: '?userName' };
      expect(qb.select(projection)).toBe(qb);
    });
  });

  describe('distinct()', () => {
    let qb;
    beforeEach(() => {
      qb = new QueryBuilder(queryId);
    });

    test('should set distinct to true', () => {
      qb.distinct();
      expect(qb.query.distinct).toBe(true);
    });

    test('should return the builder instance for chaining', () => {
      expect(qb.distinct()).toBe(qb);
    });
  });

  describe('orderBy()', () => {
    let qb;
    beforeEach(() => {
      qb = new QueryBuilder(queryId);
    });

    test('should set orderBy with key and default direction "asc"', () => {
      qb.orderBy('name');
      expect(qb.query.orderBy).toEqual({ key: 'name', direction: 'asc' });
    });

    test('should set orderBy with key and specified direction "desc"', () => {
      qb.orderBy('age', 'desc');
      expect(qb.query.orderBy).toEqual({ key: 'age', direction: 'desc' });
    });

    test('should set orderBy with key and specified direction "asc"', () => {
      qb.orderBy('age', 'asc');
      expect(qb.query.orderBy).toEqual({ key: 'age', direction: 'asc' });
    });

    test('should throw TypeError if key is not a non-empty string', () => {
      expect(() => qb.orderBy('')).toThrow(TypeError);
      expect(() => qb.orderBy('   ')).toThrow(TypeError);
      expect(() => qb.orderBy(null)).toThrow(TypeError);
      expect(() => qb.orderBy(123)).toThrow(TypeError);
    });

    test('should throw TypeError if direction is invalid', () => {
      expect(() => qb.orderBy('name', 'ascending')).toThrow(TypeError);
      expect(() => qb.orderBy('name', 'random')).toThrow(TypeError);
    });

    test('should return the builder instance for chaining', () => {
      expect(qb.orderBy('name')).toBe(qb);
    });
  });

  describe('offset()', () => {
    let qb;
    beforeEach(() => {
      qb = new QueryBuilder(queryId);
    });

    test('should set offset with a non-negative integer', () => {
      qb.offset(10);
      expect(qb.query.offset).toBe(10);
      qb.offset(0);
      expect(qb.query.offset).toBe(0);
    });

    test('should throw TypeError if count is not a non-negative integer', () => {
      expect(() => qb.offset(-1)).toThrow(TypeError);
      expect(() => qb.offset(1.5)).toThrow(TypeError);
      expect(() => qb.offset('10')).toThrow(TypeError);
      expect(() => qb.offset(null)).toThrow(TypeError);
    });

    test('should return the builder instance for chaining', () => {
      expect(qb.offset(5)).toBe(qb);
    });
  });

  describe('limit()', () => {
    let qb;
    beforeEach(() => {
      qb = new QueryBuilder(queryId);
    });

    test('should set limit with a non-negative integer', () => {
      qb.limit(20);
      expect(qb.query.limit).toBe(20);
      qb.limit(0);
      expect(qb.query.limit).toBe(0); // 0 is a valid limit
    });

    test('should throw TypeError if count is not a non-negative integer', () => {
      expect(() => qb.limit(-1)).toThrow(TypeError);
      expect(() => qb.limit(1.5)).toThrow(TypeError);
      expect(() => qb.limit('10')).toThrow(TypeError);
      expect(() => qb.limit(null)).toThrow(TypeError);
    });

    test('should return the builder instance for chaining', () => {
      expect(qb.limit(5)).toBe(qb);
    });
  });

  describe('build()', () => {
    test('should return the query object with only id and when if no other methods called', () => {
      const qb = new QueryBuilder(queryId);
      const builtQuery = qb.build();
      expect(builtQuery).toEqual({
        id: queryId,
        when: [],
        type: 'query',
      });
    });

    test('should return the query object with all specified clauses', () => {
      const qb = new QueryBuilder(queryId);
      const condition = { type: 'user', status: 'active' };
      const projection = { userName: '?name' };
      const builtQuery = qb
        .when(condition)
        .select(projection)
        .distinct()
        .orderBy('userName', 'desc')
        .offset(5)
        .limit(10)
        .build();

      expect(builtQuery).toEqual({
        id: queryId,
        when: [condition],
        select: projection,
        distinct: true,
        orderBy: { key: 'userName', direction: 'desc' },
        offset: 5,
        limit: 10,
        type: 'query',
      });
    });

    test('should build correctly even if when() is not called (relying on console.warn)', () => {
      // The QueryBuilder itself doesn't throw an error if .when() is not called,
      // it just logs a warning. We test that it builds the query object.
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const qb = new QueryBuilder(queryId);
      const projection = { constant: 'value' };
      const builtQuery = qb.select(projection).build();

      expect(builtQuery).toEqual({
        id: queryId,
        when: [],
        select: projection,
        type: 'query',
      });
      // The warning is commented out in QueryBuilder.js, so this check might not be relevant
      // if (qb.query.when.length === 0) {
      //   expect(consoleWarnSpy).toHaveBeenCalledWith(
      //     `Query [${queryId}] built with no .when() conditions. This may match broadly or rely on accumulators over all facts of a type.`
      //   );
      // }
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Query factory function', () => {
    test('should return an instance of QueryBuilder', () => {
      const q = Query(queryId);
      expect(q).toBeInstanceOf(QueryBuilder);
    });

    test('should pass the ID to the QueryBuilder constructor', () => {
      const q = Query(queryId);
      expect(q.query.id).toBe(queryId);
    });

    test('should throw an error if ID is invalid via factory', () => {
      expect(() => Query('')).toThrow('QueryBuilder: Query ID must be a non-empty string.');
    });
  });

  describe('Chaining all methods', () => {
    test('should allow chaining of all methods and build a correct query', () => {
      const condition1 = { type: 'user', name: '?n' };
      const condition2 = { _isAccumulator: true, from: { type: 'order', userId: '?id' }, accumulate: 'count', into: '?orderCount' };
      const projection = { name: '?n', orders: '?orderCount' };

      const builtQuery = Query('chainedQuery')
        .when(condition1)
        .when(condition2)
        .select(projection)
        .distinct()
        .orderBy('orders', 'desc')
        .offset(10)
        .limit(20)
        .build();

      expect(builtQuery).toEqual({
        id: 'chainedQuery',
        when: [condition1, condition2],
        select: projection,
        distinct: true,
        orderBy: { key: 'orders', direction: 'desc' },
        offset: 10,
        limit: 20,
        type: 'query',
      });
    });
  });
});