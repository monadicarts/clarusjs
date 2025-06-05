// tests/dsl/RuleBuilder.test.js
import { RuleBuilder, Rule } from '../../src/dsl/RuleBuilder';
const _ = {
  guard: {
    gt: (a, b) => ['>', a, b],
    eq: (a, b) => ['===', a, b],
    lt: (a, b) => ['<', a, b], // Add the missing 'lt' mock
    isDefined: (a) => ['isDefined', a], // Mocking a simple guard
  },
  from: (pattern) => ({
    _isAccumulator: true,
    from: pattern,
    count: () => ({
      _isAccumulator: true,
      from: pattern,
      accumulate: 'count',
      into: (varName) => ({ _isAccumulator: true, from: pattern, accumulate: 'count', into: varName }),
    }),
    sum: (field) => ({
      _isAccumulator: true,
      from: pattern,
      accumulate: 'sum',
      on: field,
      into: (varName) => ({ _isAccumulator: true, from: pattern, accumulate: 'sum', on: field, into: varName }),
    }),
  }),
  lacks: (patternObject) => ({ _isLacksCondition: true, pattern: patternObject }),
};


describe('RuleBuilder', () => {
  const MOCK_THEN_FN = jest.fn();
  const MOCK_AROUND_FN = jest.fn();
  const MOCK_AFTER_FN = jest.fn();
  const MOCK_ERROR_HANDLER_FN = jest.fn();

  beforeEach(() => {
    MOCK_THEN_FN.mockClear();
    MOCK_AROUND_FN.mockClear();
    MOCK_AFTER_FN.mockClear();
    MOCK_ERROR_HANDLER_FN.mockClear();
  });

  describe('constructor and Rule factory', () => {
    test('should create a RuleBuilder instance with a valid ID', () => {
      const rb = new RuleBuilder('myRule');
      expect(rb.rule.id).toBe('myRule');
      expect(rb.rule.when).toEqual([]);
      expect(rb.rule.pre).toEqual([]);
      expect(rb.rule.salience).toBe(0);
    });

    test('Rule factory should return a RuleBuilder instance', () => {
      const rb = Rule('factoryRule');
      expect(rb instanceof RuleBuilder).toBe(true);
      expect(rb.rule.id).toBe('factoryRule');
    });

    test('constructor should throw if ID is not a non-empty string', () => {
      expect(() => new RuleBuilder('')).toThrow('RuleBuilder: Rule ID must be a non-empty string.');
      expect(() => new RuleBuilder('   ')).toThrow('RuleBuilder: Rule ID must be a non-empty string.');
      expect(() => new RuleBuilder(null)).toThrow('RuleBuilder: Rule ID must be a non-empty string.');
      expect(() => new RuleBuilder(123)).toThrow('RuleBuilder: Rule ID must be a non-empty string.');
    });
  });

  describe('when', () => {
    test('should add conditions to the rule', () => {
      const cond1 = { type: 'user', status: 'active' };
      const cond2 = _.from({ type: 'order' }).count().into('?orderCount');
      const rb = Rule('testWhen').when(cond1, cond2);
      expect(rb.rule.when).toEqual([cond1, cond2]);
    });

    test('should append conditions on multiple calls', () => {
      const cond1 = { type: 'A' };
      const cond2 = { type: 'B' };
      const rb = Rule('testWhenAppend').when(cond1).when(cond2);
      expect(rb.rule.when).toEqual([cond1, cond2]);
    });

    test('should handle pattern with inline guards', () => {
      const patternWithGuard = [{ ticket: { assignee: '?user' } }, _.guard.eq('?user', 'admin')];
      const rb = Rule('testWhenGuard').when(patternWithGuard);
      expect(rb.rule.when).toEqual([patternWithGuard]);
    });
  });

  describe('pre', () => {
    test('should add a single pre-condition guard', () => {
      const guard1 = _.guard.gt('?age', 18);
      const rb = Rule('testPreSingle').pre(guard1);
      expect(rb.rule.pre).toEqual([guard1]);
    });

    test('should add multiple pre-condition guards (implicitly ANDed by engine)', () => {
      const guard1 = _.guard.gt('?age', 18);
      const guard2 = _.guard.eq('?status', 'approved');
      const rb = Rule('testPreMulti').pre(guard1, guard2);
      expect(rb.rule.pre).toEqual([guard1, guard2]);
    });

    test('should handle explicitly structured AND/OR S-expressions', () => {
      const orGuard = ['or', _.guard.eq('?a', 1), _.guard.eq('?b', 2)];
      const rb = Rule('testPreExplicitOr').pre(orGuard);
      expect(rb.rule.pre).toEqual([orGuard]);

      const andGuard = ['and', _.guard.gt('?c', 0), _.guard.lt('?d', 100)];
      const rb2 = Rule('testPreExplicitAnd').pre(andGuard);
      expect(rb2.rule.pre).toEqual([andGuard]);
    });

    test('should append pre-conditions on multiple calls', () => {
      const guard1 = _.guard.gt('?x', 0);
      const guard2 = _.guard.lt('?y', 0);
      const rb = Rule('testPreAppend').pre(guard1).pre(guard2);
      expect(rb.rule.pre).toEqual([guard1, guard2]);
    });
  });

  describe('then', () => {
    test('should set the action function', () => {
      const rb = Rule('testThen').then(MOCK_THEN_FN);
      expect(rb.rule.then).toBe(MOCK_THEN_FN);
    });

    test('should throw if actionFn is not a function', () => {
      const rb = Rule('testThenError');
      expect(() => rb.then('not a function')).toThrow('Rule [testThenError] .then() action must be a function.');
      expect(() => rb.then(null)).toThrow('Rule [testThenError] .then() action must be a function.');
    });
  });

  describe('salience', () => {
    test('should set the salience value', () => {
      const rb = Rule('testSalience').salience(100);
      expect(rb.rule.salience).toBe(100);
    });

    test('should throw if priority is not a number', () => {
      const rb = Rule('testSalienceError');
      expect(() => rb.salience('high')).toThrow('Rule [testSalienceError] salience must be a number. Got: string');
    });
  });

  describe('around', () => {
    test('should set the around advice function', () => {
      const rb = Rule('testAround').around(MOCK_AROUND_FN);
      expect(rb.rule.around).toBe(MOCK_AROUND_FN);
    });

    test('should throw if aroundFn is not a function', () => {
      const rb = Rule('testAroundError');
      expect(() => rb.around({})).toThrow('Rule [testAroundError] .around() advice must be a function.');
    });
  });

  describe('after', () => {
    test('should set the after advice function', () => {
      const rb = Rule('testAfter').after(MOCK_AFTER_FN);
      expect(rb.rule.after).toBe(MOCK_AFTER_FN);
    });

    test('should throw if afterFn is not a function', () => {
      const rb = Rule('testAfterError');
      expect(() => rb.after(123)).toThrow('Rule [testAfterError] .after() advice must be a function.');
    });
  });

  describe('post', () => {
    test('should set post-conditions, wrapping simple patterns', () => {
      const postCond1 = { type: 'log_entry', ruleId: 'testPost' };
      const rb = Rule('testPost').post(postCond1);
      expect(rb.rule.post).toEqual([[postCond1]]);
    });

    test('should set post-conditions with existing [pattern, ...guards] arrays', () => {
      const postCondWithGuard = [{ type: 'audit', action: 'fired' }, _.guard.isDefined('?user')];
      const rb = Rule('testPostGuard').post(postCondWithGuard);
      expect(rb.rule.post).toEqual([postCondWithGuard]);
    });

    test('should handle multiple post-conditions', () => {
      const postCond1 = { type: 'A' };
      const postCond2 = [{ type: 'B' }, _.guard.eq('?status', 'done')];
      const rb = Rule('testPostMulti').post(postCond1, postCond2);
      expect(rb.rule.post).toEqual([[postCond1], postCond2]);
    });
  });

  describe('throws', () => {
    test('should set error handlers object', () => {
      const handlers = { 'TypeError': MOCK_ERROR_HANDLER_FN, 'CustomError': jest.fn() };
      const rb = Rule('testThrows').throws(handlers);
      expect(rb.rule.throws).toEqual(handlers);
    });

    test('should throw if errorHandlers is not an object', () => {
      const rb = Rule('testThrowsError');
      expect(() => rb.throws('string')).toThrow('Rule [testThrowsError] .throws() argument must be an object.');
    });

    test('should throw if any handler in errorHandlers is not a function', () => {
      const rb = Rule('testThrowsError');
      const handlers = { 'TypeError': MOCK_ERROR_HANDLER_FN, 'BadHandler': 'not a function' };
      expect(() => rb.throws(handlers)).toThrow("Rule [testThrowsError] .throws() handler for 'BadHandler' must be a function.");
    });
  });

  describe('log', () => {
    test('should set log configuration object', () => {
      const logConfig = { before: true, after: false };
      const rb = Rule('testLog').log(logConfig);
      expect(rb.rule.log).toEqual(logConfig);
    });

    test('should throw if logConfig is not an object', () => {
      const rb = Rule('testLogError');
      expect(() => rb.log(true)).toThrow('Rule [testLogError] .log() argument must be an object.');
    });
  });

  describe('build', () => {
    test('should return the complete rule definition object', () => {
      const ruleDef = Rule('finalRule')
        .when({ type: 'A' })
        .pre(_.guard.gt('?val', 10))
        .then(MOCK_THEN_FN)
        .salience(5)
        .around(MOCK_AROUND_FN)
        .after(MOCK_AFTER_FN)
        .post({ type: 'B' })
        .throws({ 'Error': MOCK_ERROR_HANDLER_FN })
        .log({ before: true })
        .build();

      expect(ruleDef).toEqual({
        id: 'finalRule',
        when: [{ type: 'A' }],
        pre: [_.guard.gt('?val', 10)],
        then: MOCK_THEN_FN,
        salience: 5,
        around: MOCK_AROUND_FN,
        after: MOCK_AFTER_FN,
        post: [[{ type: 'B' }]],
        throws: { 'Error': MOCK_ERROR_HANDLER_FN },
        log: { before: true },
      });
    });

    test('should throw if .then() action is not defined before building', () => {
      const rb = Rule('buildErrorNoThen').when({ type: 'data' });
      expect(() => rb.build()).toThrow('Rule [buildErrorNoThen] must have a .then() action defined before building.');
    });

    test('should build with minimal requirements (ID and then)', () => {
      const ruleDef = Rule('minimalRule').then(MOCK_THEN_FN).build();
      expect(ruleDef).toEqual({
        id: 'minimalRule',
        when: [],
        pre: [],
        then: MOCK_THEN_FN,
        salience: 0,
      });
    });

    test('should ensure rule.pre is an array even if not called', () => {
      const ruleDef = Rule('preNotCalled').then(MOCK_THEN_FN).build();
      expect(Array.isArray(ruleDef.pre)).toBe(true);
      expect(ruleDef.pre).toEqual([]);
    });
  });
});
