// tests/dsl/pattern-helpers.test.js
import { _ } from '../../src/dsl/pattern-helpers'; // Adjust path as needed

describe('Pattern Helpers (_)', () => {
  describe('I. Core Predicates & Type/Existence Checks', () => {
    describe('isType', () => {
      test('should correctly identify primitive types', () => {
        expect(_.isType('string')('hello')).toBe(true);
        expect(_.isType('string')(123)).toBe(false);
        expect(_.isType('number')(123)).toBe(true);
        expect(_.isType('number')('123')).toBe(false);
        expect(_.isType('boolean')(true)).toBe(true);
        expect(_.isType('boolean')(0)).toBe(false);
        expect(_.isType('object')({})).toBe(true);
        expect(_.isType('object')(null)).toBe(false); // typeof null is 'object' but we handle it
        expect(_.isType('function')(() => {})).toBe(true);
        expect(_.isType('symbol')(Symbol())).toBe(true);
        expect(_.isType('undefined')(undefined)).toBe(true);
        expect(_.isType('bigint')(123n)).toBe(true);
      });
      test('should correctly identify array type', () => {
        expect(_.isType('array')([])).toBe(true);
        expect(_.isType('array')({})).toBe(false);
      });
      test('should correctly identify null type', () => {
        expect(_.isType('null')(null)).toBe(true);
        expect(_.isType('null')(undefined)).toBe(false);
        expect(_.isType('null')({})).toBe(false);
      });
      test('should handle "any" type', () => {
        expect(_.isType('any')('hello')).toBe(true);
        expect(_.isType('any')(null)).toBe(true);
        expect(_.isType('any')(undefined)).toBe(true);
      });
      // Test for custom template types (engine resolves these, helper is for primitives)
      test('should return false for unknown/custom types if value is not that typeof', () => {
        expect(_.isType('userTemplate')({ type: 'userTemplate' })).toBe(false); // typeof is 'object'
        expect(_.isType('userTemplate')('a string')).toBe(false);
      });
    });

    test('isNull should check for strict null', () => {
      expect(_.isNull()(null)).toBe(true);
      expect(_.isNull()(undefined)).toBe(false);
      expect(_.isNull()(0)).toBe(false);
    });

    test('isUndefined should check for strict undefined', () => {
      expect(_.isUndefined()(undefined)).toBe(true);
      expect(_.isUndefined()(null)).toBe(false);
      expect(_.isUndefined()(0)).toBe(false);
    });

    test('isNil should check for null or undefined', () => {
      expect(_.isNil()(null)).toBe(true);
      expect(_.isNil()(undefined)).toBe(true);
      expect(_.isNil()(0)).toBe(false);
      expect(_.isNil()('')).toBe(false);
    });

    test('isDefined should check for not null and not undefined', () => {
      expect(_.isDefined()(0)).toBe(true);
      expect(_.isDefined()('')).toBe(true);
      expect(_.isDefined()({})).toBe(true);
      expect(_.isDefined()(null)).toBe(false);
      expect(_.isDefined()(undefined)).toBe(false);
    });

    describe('hasProperty', () => {
      const obj = { a: 1, b: undefined };
      Object.defineProperty(obj, 'c', { value: 3, enumerable: false });
      const proto = { d: 4 };
      const objWithProto = Object.create(proto);
      objWithProto.e = 5;

      test('should return true for own properties', () => {
        expect(_.hasProperty('a')(obj)).toBe(true);
        expect(_.hasProperty('b')(obj)).toBe(true); // undefined is still an own property
        expect(_.hasProperty('c')(obj)).toBe(true); // non-enumerable own property
        expect(_.hasProperty('e')(objWithProto)).toBe(true);
      });
      test('should return false for non-existent or inherited properties', () => {
        expect(_.hasProperty('z')(obj)).toBe(false);
        expect(_.hasProperty('d')(objWithProto)).toBe(false); // inherited
      });
      test('should return false for non-object values', () => {
        expect(_.hasProperty('a')(null)).toBe(false);
        expect(_.hasProperty('a')(undefined)).toBe(false);
        expect(_.hasProperty('length')('string')).toBe(false); // 'length' is on String.prototype
      });
    });
  });

  describe('II. String Operators', () => {
    test('startsWith', () => {
      const p = _.startsWith('abc');
      expect(p('abcdef')).toBe(true);
      expect(p('ab')).toBe(false);
      expect(p('xyzabc')).toBe(false);
      expect(p(123)).toBe(false);
    });
    test('endsWith', () => {
      const p = _.endsWith('def');
      expect(p('abcdef')).toBe(true);
      expect(p('ef')).toBe(false);
      expect(p('defxyz')).toBe(false);
      expect(p(123)).toBe(false);
    });
    test('matches', () => {
      const p = _.matches(/^a\d+b$/);
      expect(p('a123b')).toBe(true);
      expect(p('a1b')).toBe(true);
      expect(p('ab')).toBe(false);
      expect(p('a123bc')).toBe(false);
      expect(p(123)).toBe(false);
    });
  });

  describe('III. Numeric / Range Operators', () => {
    test('gt', () => {
      const p = _.gt(10);
      expect(p(11)).toBe(true);
      expect(p(10)).toBe(false);
      expect(p(9)).toBe(false);
      expect(p('11')).toBe(false);
      expect(p(NaN)).toBe(false);
    });
    test('gte', () => {
      const p = _.gte(10);
      expect(p(11)).toBe(true);
      expect(p(10)).toBe(true);
      expect(p(9)).toBe(false);
    });
    test('lt', () => {
      const p = _.lt(10);
      expect(p(9)).toBe(true);
      expect(p(10)).toBe(false);
      expect(p(11)).toBe(false);
    });
    test('lte', () => {
      const p = _.lte(10);
      expect(p(9)).toBe(true);
      expect(p(10)).toBe(true);
      expect(p(11)).toBe(false);
    });
    test('between', () => {
      const p = _.between(5, 10);
      expect(p(5)).toBe(true);
      expect(p(7)).toBe(true);
      expect(p(10)).toBe(true);
      expect(p(4)).toBe(false);
      expect(p(11)).toBe(false);
      expect(p(NaN)).toBe(false);
    });
  });

  describe('IV. Collection Operators', () => {
    test('contains', () => {
      const p = _.contains('b');
      expect(p(['a', 'b', 'c'])).toBe(true);
      expect(p(['a', 'c'])).toBe(false);
      expect(p([])).toBe(false);
      expect(p('abc')).toBe(false); // Only for arrays
      const pNum = _.contains(2);
      expect(pNum([1, 2, 3])).toBe(true);
    });
    describe('hasSize', () => {
      test('with number', () => {
        const p = _.hasSize(3);
        expect(p([1, 2, 3])).toBe(true);
        expect(p('abc')).toBe(true);
        expect(p(new Set([1, 2, 3]))).toBe(true);
        expect(p(new Map([['a',1],['b',2],['c',3]]))).toBe(true);
        expect(p([1, 2])).toBe(false);
        expect(p({})).toBe(false); // No .length or .size
      });
      test('with predicate', () => {
        const p = _.hasSize(_.gt(2));
        expect(p([1, 2, 3])).toBe(true);
        expect(p([1, 2])).toBe(false);
      });
    });
    test('intersects', () => {
      const p = _.intersects(['b', 'd']);
      expect(p(['a', 'b', 'c'])).toBe(true);
      expect(p(['d', 'e'])).toBe(true);
      expect(p(['a', 'c', 'e'])).toBe(false);
      expect(p([])).toBe(false);
      expect(_.intersects([])(['a', 'b'])).toBe(false);
      expect(_.intersects(['a'])(null)).toBe(false);
    });
  });

  describe('V. Functional & Higher-Order Operators', () => {
    test('every with predicate', () => {
      const p = _.every(x => x > 0);
      expect(p([1, 2, 3])).toBe(true);
      expect(p([1, 0, 3])).toBe(false);
      expect(p([])).toBe(true); // Vacuously true
      expect(p('abc')).toBe(false);
    });
    test('every with value', () => {
      const p = _.every(true);
      expect(p([true, true, true])).toBe(true);
      expect(p([true, false, true])).toBe(false);
    });
    test('some with predicate', () => {
      const p = _.some(x => x > 2);
      expect(p([1, 2, 3])).toBe(true);
      expect(p([1, 0, 2])).toBe(false);
      expect(p([])).toBe(false);
      expect(p('abc')).toBe(false);
    });
    test('some with value', () => {
      const p = _.some(true);
      expect(p([false, false, true])).toBe(true);
      expect(p([false, false, false])).toBe(false);
    });
    test('transform', () => {
      const p = _.transform(s => s.toUpperCase(), 'HELLO');
      expect(p('hello')).toBe(true);
      expect(p('world')).toBe(false);
      const pNum = _.transform(x => x * 2, _.gt(10));
      expect(pNum(6)).toBe(true); // 12 > 10
      expect(pNum(5)).toBe(false); // 10 not > 10
    });
    test('is', () => {
      const customValidator = x => x % 2 === 0;
      const p = _.is(customValidator);
      expect(p(4)).toBe(true);
      expect(p(3)).toBe(false);
    });
  });

  describe('VI. Logical Combinators', () => {
    test('allOf', () => {
      const p = _.allOf(_.isType('string'), _.startsWith('a'));
      expect(p('apple')).toBe(true);
      expect(p('banana')).toBe(false); // Fails startsWith('a')
      expect(p(123)).toBe(false);     // Fails isType('string')
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      expect(_.allOf(true, x => x > 10)(11)).toBe(true); // non-function predicate
      expect(consoleWarnSpy).toHaveBeenCalledWith("Non-function passed to _.allOf");
      consoleWarnSpy.mockRestore();
    });
    test('anyOf', () => {
      const p = _.anyOf('admin', 'editor', _.startsWith('guest_'));
      expect(p('admin')).toBe(true);
      expect(p('editor')).toBe(true);
      expect(p('guest_123')).toBe(true);
      expect(p('user')).toBe(false);
      expect(p(null)).toBe(false);
    });
    test('not with predicate', () => {
      const p = _.not(_.gt(10));
      expect(p(5)).toBe(true);  // not (5 > 10) -> true
      expect(p(10)).toBe(true); // not (10 > 10) -> true
      expect(p(11)).toBe(false); // not (11 > 10) -> false
    });
    test('not with value', () => {
      const p = _.not('disabled');
      expect(p('active')).toBe(true);
      expect(p('disabled')).toBe(false);
    });
  });

  describe('VII. Negation As Failure (NAF)', () => {
    test('lacks should return a lacks condition object', () => {
      const pattern = { type: 'error' };
      expect(_.lacks(pattern)).toEqual({ _isLacksCondition: true, pattern });
    });
  });

  describe('VIII. Accumulator Builder (`_.from`)', () => {
    const pattern = { type: 'order' };
    const fromBuilder = _.from(pattern);

    test('from should return an object with accumulator methods', () => {
      expect(typeof fromBuilder.sum).toBe('function');
      expect(typeof fromBuilder.count).toBe('function');
      expect(typeof fromBuilder.average).toBe('function');
      expect(typeof fromBuilder.collect).toBe('function');
    });

    test('sum().into() should create a sum accumulator definition', () => {
      const accDef = fromBuilder.sum('total').into('?totalSum');
      expect(accDef).toEqual({
        _isAccumulator: true,
        from: pattern,
        accumulate: 'sum',
        on: 'total',
        into: '?totalSum',
      });
    });

    test('count().into() should create a count accumulator definition', () => {
      const accDef = fromBuilder.count().into('?orderCount');
      expect(accDef).toEqual({
        _isAccumulator: true,
        from: pattern,
        accumulate: 'count',
        into: '?orderCount',
      });
    });

    test('average().into() should create an average accumulator definition', () => {
      const accDef = fromBuilder.average('amount').into('?avgAmount');
      expect(accDef).toEqual({
        _isAccumulator: true,
        from: pattern,
        accumulate: 'average',
        on: 'amount',
        into: '?avgAmount',
      });
    });

    test('collect().into() should create a collect accumulator definition', () => {
      const accDef = fromBuilder.collect('id').into('?orderIds');
      expect(accDef).toEqual({
        _isAccumulator: true,
        from: pattern,
        accumulate: 'collect',
        on: 'id',
        into: '?orderIds',
      });
    });
  });

  describe('IX. Guard & Select Expression Builders', () => {
    const varA = '?a';
    const varB = '?b';
    const literal1 = 10;

    test('_.guard.gt should create a ">" S-expression', () => {
      expect(_.guard.gt(varA, literal1)).toEqual(['>', varA, literal1]);
    });
    test('_.guard.gte should create a ">=" S-expression', () => {
      expect(_.guard.gte(varA, literal1)).toEqual(['>=', varA, literal1]);
    });
    test('_.guard.lt should create a "<" S-expression', () => {
      expect(_.guard.lt(varA, literal1)).toEqual(['<', varA, literal1]);
    });
    test('_.guard.lte should create a "<=" S-expression', () => {
      expect(_.guard.lte(varA, literal1)).toEqual(['<=', varA, literal1]);
    });
    test('_.guard.eq should create a "===" S-expression', () => {
      expect(_.guard.eq(varA, varB)).toEqual(['===', varA, varB]);
    });
    test('_.guard.neq should create a "!==" S-expression', () => {
      expect(_.guard.neq(varA, literal1)).toEqual(['!==', varA, literal1]);
    });
    test('_.guard.add should create a "+" S-expression', () => {
      expect(_.guard.add(varA, varB, 5)).toEqual(['+', varA, varB, 5]);
    });
    test('_.guard.subtract should create a "-" S-expression', () => {
      expect(_.guard.subtract(varA, literal1)).toEqual(['-', varA, literal1]);
    });
    test('_.guard.multiply should create a "*" S-expression', () => {
      expect(_.guard.multiply(varA, 2, varB)).toEqual(['*', varA, 2, varB]);
    });
    test('_.guard.divide should create a "/" S-expression', () => {
      expect(_.guard.divide(varA, 2)).toEqual(['/', varA, 2]);
    });
    test('_.guard.path should create a "path" S-expression', () => {
      expect(_.guard.path('?user', 'address', 'street')).toEqual(['path', '?user', 'address', 'street']);
      expect(_.guard.path('?data', 0, 'value')).toEqual(['path', '?data', 0, 'value']);
    });
    test('_.guard.pathOr should create a "pathOr" S-expression', () => {
      expect(_.guard.pathOr('N/A', '?user', 'profile', 'name')).toEqual(['pathOr', 'N/A', '?user', 'profile', 'name']);
      expect(_.guard.pathOr(null, '?arr', 10, 'id')).toEqual(['pathOr', null, '?arr', 10, 'id']);
    });

    test('_.select should be an alias to _.guard', () => {
      expect(_.select).toBe(_.guard);
      expect(_.select.gt('?x', 1)).toEqual(['>', '?x', 1]); // Verify one method
    });
  });
});
