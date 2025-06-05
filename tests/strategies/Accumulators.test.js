// tests/strategies/Accumulators.test.js
import { accumulators } from '../../src/strategies/Accumulators';

describe('Accumulators', () => {
  describe('sum', () => {
    const sum = accumulators.sum('amount');

    it('sums numeric values', () => {
      expect(sum([{ amount: 10 }, { amount: 20 }, { amount: 5.5 }])).toBe(35.5);
    });

    it('treats boolean true as 1, false as 0', () => {
      expect(sum([{ amount: true }, { amount: 10 }, { amount: false }])).toBe(11);
    });

    it('ignores non-numeric values and missing fields', () => {
      expect(sum([{ amount: 10 }, { amount: 'abc' }, {}, { amount: null }, { amount: undefined }])).toBe(10);
    });

    it('returns 0 for an empty array', () => {
      expect(sum([])).toBe(0);
    });

    it('handles negative numbers', () => {
      expect(sum([{ amount: -5 }, { amount: 10 }, { amount: -2.5 }])).toBe(2.5);
    });
  });

  describe('count', () => {
    const count = accumulators.count();

    it('counts the number of facts', () => {
      expect(count([{}, { id: 1 }, { id: 2 }])).toBe(3);
    });

    it('returns 0 for an empty array', () => {
      expect(count([])).toBe(0);
    });
  });

  describe('average', () => {
    const avg = accumulators.average('score');

    it('calculates the average of numeric values', () => {
      expect(avg([{ score: 10 }, { score: 20 }, { score: 30 }])).toBe(20);
    });

    it('treats boolean true as 1, false as 0', () => {
      expect(avg([{ score: true }, { score: 9 }, { score: false }])).toBeCloseTo(10 / 3);
    });

    it('ignores non-numeric values and missing fields', () => {
      expect(avg([{ score: 10 }, { score: 'xyz' }, {}, { score: 30 }, { score: null }])).toBe(20);
    });

    it('returns 0 if no valid numeric values', () => {
      expect(avg([{ score: 'a' }, { score: 'b' }, {}])).toBe(0);
    });

    it('returns 0 for an empty array', () => {
      expect(avg([])).toBe(0);
    });
  });

  describe('collect', () => {
    const collect = accumulators.collect('name');

    it('collects all values for the specified field', () => {
      expect(collect([{ name: 'Alice' }, { name: 'Bob' }, { name: 'Alice' }])).toEqual(['Alice', 'Bob', 'Alice']);
    });

    it('includes undefined if field is missing', () => {
      expect(collect([{ name: 'Alice' }, {}, { name: 'Charlie' }])).toEqual(['Alice', undefined, 'Charlie']);
    });

    it('includes null if field value is null', () => {
      expect(collect([{ name: 'Alice' }, { name: null }, { name: 'Charlie' }])).toEqual(['Alice', null, 'Charlie']);
    });

    it('returns an empty array if facts array is empty', () => {
      expect(collect([])).toEqual([]);
    });
  });

  describe('minNumber', () => {
    const minNum = accumulators.minNumber('price');

    it('finds the minimum numeric value', () => {
      expect(minNum([{ price: 100 }, { price: 20 }, { price: 50 }])).toBe(20);
    });

    it('handles negative numbers', () => {
      expect(minNum([{ price: -5 }, { price: 0 }, { price: -100 }])).toBe(-100);
    });

    it('returns Infinity if no numeric values', () => {
      expect(minNum([{ price: 'abc' }, {}])).toBe(Infinity);
    });

    it('ignores null/undefined values', () => {
      expect(minNum([{ price: null }, { price: 10 }, { price: undefined }, { price: 5 }])).toBe(5);
    });
  });

  describe('maxNumber', () => {
    const maxNum = accumulators.maxNumber('price');

    it('finds the maximum numeric value', () => {
      expect(maxNum([{ price: 10 }, { price: 200 }, { price: 50 }])).toBe(200);
    });

    it('handles negative numbers', () => {
      expect(maxNum([{ price: -50 }, { price: 0 }, { price: -10 }])).toBe(0);
    });

    it('returns -Infinity if no numeric values', () => {
      expect(maxNum([{ price: 'abc' }, {}])).toBe(-Infinity);
    });

    it('ignores null/undefined values', () => {
      expect(maxNum([{ price: null }, { price: 10 }, { price: undefined }, { price: 50 }])).toBe(50);
    });
  });

  describe('minDate', () => {
    const minDate = accumulators.minDate('timestamp');

    it('finds the minimum date value (Date objects)', () => {
      const d1 = new Date(2000, 0, 1);
      const d2 = new Date(1990, 0, 1);
      const d3 = new Date(2010, 0, 1);
      expect(minDate([{ timestamp: d1 }, { timestamp: d2 }, { timestamp: d3 }])).toEqual(d2);
    });

    it('finds the minimum date value (parseable strings/numbers)', () => {
      const d = new Date(1990, 0, 1);
      expect(
        minDate([
          { timestamp: '2000-01-01' },
          { timestamp: d.getTime() },
          { timestamp: '2010-01-01' }
        ])
      ).toEqual(d);
    });

    it('returns null if no valid dates for min', () => {
      expect(minDate([{ timestamp: 'invalid-date' }, {}])).toBeNull();
    });
  });

  describe('maxDate', () => {
    const maxDate = accumulators.maxDate('timestamp');

    it('finds the maximum date value (Date objects)', () => {
      const d1 = new Date(2000, 0, 1);
      const d2 = new Date(1990, 0, 1);
      const d3 = new Date(2010, 0, 1);
      expect(maxDate([{ timestamp: d1 }, { timestamp: d2 }, { timestamp: d3 }])).toEqual(d3);
    });

    it('finds the maximum date value (parseable strings/numbers)', () => {
      const d = new Date(2010, 0, 1);
      expect(
        maxDate([
          { timestamp: '2000-01-01' },
          { timestamp: d.getTime() },
          { timestamp: '1990-01-01' }
        ])
      ).toEqual(d);
    });

    it('returns null if no valid dates for max', () => {
      expect(maxDate([{ timestamp: 'invalid-date' }, {}])).toBeNull();
    });
  });

  describe('minString', () => {
    const minStr = accumulators.minString('name');

    it('finds the minimum string value (lexicographical)', () => {
      expect(minStr([{ name: 'Charlie' }, { name: 'Alice' }, { name: 'Bob' }])).toBe('Alice');
    });

    it('returns undefined if no strings for min', () => {
      expect(minStr([{ name: 123 }, {}])).toBeUndefined();
    });
  });

  describe('maxString', () => {
    const maxStr = accumulators.maxString('name');

    it('finds the maximum string value (lexicographical)', () => {
      expect(maxStr([{ name: 'Charlie' }, { name: 'Alice' }, { name: 'David' }])).toBe('David');
    });

    it('returns undefined if no strings for max', () => {
      expect(maxStr([{ name: 123 }, {}])).toBeUndefined();
    });
  });

  describe('minBoolean', () => {
    const minBool = accumulators.minBoolean('isActive');

    it('finds the minimum boolean value (false < true)', () => {
      expect(minBool([{ isActive: true }, { isActive: false }, { isActive: true }])).toBe(false);
      expect(minBool([{ isActive: true }, { isActive: true }])).toBe(true);
    });

    it('returns null if no booleans for min', () => {
      expect(minBool([{ isActive: 'yes' }, {}])).toBeNull();
    });
  });

  describe('maxBoolean', () => {
    const maxBool = accumulators.maxBoolean('isActive');

    it('finds the maximum boolean value (true > false)', () => {
      expect(maxBool([{ isActive: true }, { isActive: false }, { isActive: false }])).toBe(true);
      expect(maxBool([{ isActive: false }, { isActive: false }])).toBe(false);
    });

    it('returns null if no booleans for max', () => {
      expect(maxBool([{ isActive: 'yes' }, {}])).toBeNull();
    });
  });

  describe('distinctCollect', () => {
    const distinct = accumulators.distinctCollect('tag');

    it('collects unique values for the specified field', () => {
      const facts = [{ tag: 'A' }, { tag: 'B' }, { tag: 'A' }, { tag: 'C' }, { tag: 'B' }];
      const result = distinct(facts);
      expect(result).toHaveLength(3);
      expect(result).toEqual(expect.arrayContaining(['A', 'B', 'C']));
    });

    it('handles undefined and null as distinct values', () => {
      const facts = [
        { tag: 'A' },
        {},
        { tag: null },
        { tag: 'A' },
        { tag: undefined },
        { tag: null }
      ];
      const result = distinct(facts);
      expect(result).toHaveLength(3);
      expect(result).toEqual(expect.arrayContaining(['A', undefined, null]));
    });

    it('returns an empty array if facts array is empty', () => {
      expect(distinct([])).toEqual([]);
    });

    it('handles different data types correctly for uniqueness', () => {
      const facts = [
        { tag: 1 },
        { tag: '1' },
        { tag: 1 },
        { tag: true },
        { tag: 'true' }
      ];
      expect(distinct(facts)).toEqual([1, '1', true, 'true']);
    });

    it('collects from field even if some facts do not have it', () => {
      const facts = [{ tag: 'one' }, { id: 1 }, { tag: 'two' }, { tag: 'one' }];
      const result = distinct(facts);
      expect(result).toHaveLength(3);
      expect(result).toEqual(expect.arrayContaining(['one', 'two', undefined]));
    });
  });
});
