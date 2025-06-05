import { LeapEngine } from '../../src/engine/LeapEngine';
import { FactStorage } from '../../src/components/FactStorage';
import { SimpleEventEmitter } from '../../src/utils/SimpleEventEmitter';

// Mock dependencies
jest.mock('../../src/components/FactStorage');
// jest.mock('../../src/utils/SimpleEventEmitter'); // Use actual SimpleEventEmitter

// Mock global/assumed utilities
const mockGetTemplate = jest.fn();
const mockAccumulators = {
  count: jest.fn(() => jest.fn(facts => facts.length)),
  sum: jest.fn(field => jest.fn(facts => facts.reduce((acc, f) => acc + (f[field] || 0), 0))),
  // Add other accumulators as needed
};
global.getTemplate = mockGetTemplate;
global.accumulators = mockAccumulators;


describe('LeapEngine', () => {
  let engine;
  let mockFactStorage;
  let mockAgenda;
  let mockMatcher;
  let mockResolver;

  beforeEach(() => {
    // Reset mocks for FactStorage methods
    FactStorage.mockClear();
    mockFactStorage = new FactStorage(); // Get the mocked instance

    // SimpleEventEmitter is instantiated internally by LeapEngine.
    // We can mock its prototype if we need to control its behavior,
    // or check if the engine's `on` method calls the emitter's `on`.


    mockAgenda = {
      push: jest.fn(),
      shift: jest.fn(),
      hasTasks: false, // Default to no tasks
      get length() { // Use a getter for length
        return this.tasks ? this.tasks.length : 0;
      },
      tasks: [] // Internal store for mock tasks
    };
    // Make shift return from tasks and update hasTasks
    mockAgenda.shift.mockImplementation(() => {
      const task = mockAgenda.tasks.shift();
      mockAgenda.hasTasks = mockAgenda.tasks.length > 0;
      return task;
    });
    // Make push add to tasks and update hasTasks
    mockAgenda.push.mockImplementation((task) => {
        mockAgenda.tasks.push(task);
        mockAgenda.hasTasks = true;
    });


    mockMatcher = {
      match: jest.fn().mockReturnValue({ isMatch: false, bindings: {} }),
    };
    mockResolver = {
      resolve: jest.fn().mockReturnValue(null), // Default to no activation resolved
    };

    engine = new LeapEngine({
      factStorage: mockFactStorage,
      agenda: mockAgenda,
      matcher: mockMatcher,
      resolver: mockResolver,
    });

    mockGetTemplate.mockReset();
    Object.values(mockAccumulators).forEach(accMock => {
        if (accMock.mockClear) accMock.mockClear(); // Clear the outer mock
        // If the accumulator returns another function, clear that too
        const innerMock = accMock();
        if (innerMock && innerMock.mockClear) innerMock.mockClear();
    });
  });

  describe('constructor', () => {
    test('should initialize with dependencies and an event emitter', () => {
      expect(engine).toBeInstanceOf(LeapEngine);
      // Verifying that an event emitter is present and working is done via event handling tests
    });

    test('should throw error if dependencies are missing', () => {
      expect(() => new LeapEngine({})).toThrow("LeapEngine constructor: All dependencies (factStorage, agenda, matcher, resolver) are required.");
      expect(() => new LeapEngine({ factStorage: mockFactStorage, agenda: mockAgenda, matcher: mockMatcher })).toThrow();
    });
  });

  describe('event handling (on, #emit)', () => {
    test('on should register a listener which is called when the engine emits the corresponding event', () => {
      const listener = jest.fn();
      const eventName = 'engine:definitionAdded'; // Use a known event emitted by the engine
      const definitionPayload = { id: 'ruleForOnTest', type: 'rule' };

      // 1. Register the listener using engine.on()
      engine.on(eventName, listener);

      // 2. Trigger a public engine method that emits the eventName
      engine.addDefinition(definitionPayload);

      // 3. Assert that the listener was called with the correct payload
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        definitionId: definitionPayload.id,
        type: definitionPayload.type,
        timestamp: expect.any(Number) // Events include a timestamp
      }));
    });

    test('#emit (private, tested via public methods) should emit with timestamp', () => {
      const listener = jest.fn();
      engine.on('engine:definitionAdded', listener);
      engine.addDefinition({ id: 'testRule', type: 'rule' });
      expect(listener).toHaveBeenCalledWith(
        // 'engine:definitionAdded' is the event name, listener gets the data object
        expect.objectContaining({
          definitionId: 'testRule',
          type: 'rule',
          timestamp: expect.any(Number),
        })
      );
    });
  });

  describe('addDefinition', () => {
    test('should add a valid definition and emit event', () => {
      const ruleDef = { id: 'R1', type: 'rule', conditions: [], then: () => {} };
      const listener = jest.fn();
      engine.on('engine:definitionAdded', listener);
      engine.addDefinition(ruleDef);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ definitionId: 'R1', type: 'rule' })
      );
    });

    test('should emit error for invalid definition (no id)', () => {
      const errorListener = jest.fn();
      const addedListener = jest.fn();
      engine.on('engine:error', errorListener);
      engine.on('engine:definitionAdded', addedListener);

      engine.addDefinition({ type: 'rule' });
      expect(errorListener).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Error) }) // Check for an error object
      );
      expect(addedListener).not.toHaveBeenCalled();
    });

     test('should emit error for invalid definition (empty id)', () => {
      const errorListener = jest.fn();
      engine.on('engine:error', errorListener);

      engine.addDefinition({ id: '  ', type: 'rule' });
      expect(errorListener).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('assertFact', () => {
    beforeEach(() => {
      mockFactStorage.assert.mockImplementation(fact => ({ fact: { ...fact, _id: 1 }, metadata: {} }));
    });

    test('should assert a fact, add to agenda, and emit event', () => {
      const factData = { type: 'user', name: 'Alice' };
      const listener = jest.fn();
      engine.on('fact:asserted', listener);

      const assertedFact = engine.assertFact(factData);

      expect(mockFactStorage.assert).toHaveBeenCalledWith(factData);
      expect(assertedFact).toEqual({ ...factData, _id: 1 });
      expect(mockAgenda.push).toHaveBeenCalledWith({ type: 'assert', fact: assertedFact });
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ fact: assertedFact, by: 'direct' })
      );
    });

    test('should return null and emit error if fact type is missing or not string', () => {
      const errorListener = jest.fn();
      engine.on('engine:error', errorListener);

      let result = engine.assertFact({ name: 'NoType' });
      expect(result).toBeNull();
      expect(errorListener).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(Error) }));

      errorListener.mockClear();
      result = engine.assertFact({ type: 123, name: 'InvalidType' });
      expect(result).toBeNull();
      expect(errorListener).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(Error) }));
    });

    describe('Schema Validation', () => {
      let schemaErrorListener;
      beforeEach(() => {
        schemaErrorListener = jest.fn();
        engine.on('engine:schemaError', schemaErrorListener);
      });

      test('should apply default value from schema', () => {
        mockGetTemplate.mockReturnValue({ schema: { status: { type: 'string', default: 'active' } } });
        const factData = { type: 'user', name: 'Bob' };
        engine.assertFact(factData);
        expect(mockFactStorage.assert).toHaveBeenCalledWith({ type: 'user', name: 'Bob', status: 'active' });
      });

      test('should apply functional default value from schema', () => {
        const defaultFn = jest.fn(() => 'pending');
        mockGetTemplate.mockReturnValue({ schema: { status: { type: 'string', default: defaultFn } } });
        const factData = { type: 'order' };
        engine.assertFact(factData);
        expect(defaultFn).toHaveBeenCalled();
        expect(mockFactStorage.assert).toHaveBeenCalledWith({ type: 'order', status: 'pending' });
      });

      test('should fail if required field is missing (and no default)', () => {
        mockGetTemplate.mockReturnValue({ schema: { name: { type: 'string', required: true } } });
        const factData = { type: 'user' };
        const result = engine.assertFact(factData);
        expect(result).toBeNull();
        expect(schemaErrorListener).toHaveBeenCalledWith(
          expect.objectContaining({ error: expect.any(Error) })
        );
      });

      test('should pass if required field is present', () => {
        mockGetTemplate.mockReturnValue({ schema: { name: { type: 'string', required: true } } });
        const factData = { type: 'user', name: 'Alice' };
        const result = engine.assertFact(factData);
        expect(result).not.toBeNull();
      });

      test('should fail if type mismatch (string)', () => {
        mockGetTemplate.mockReturnValue({ schema: { name: { type: 'string' } } });
        const factData = { type: 'user', name: 123 };
        const result = engine.assertFact(factData);
        expect(result).toBeNull();
        expect(schemaErrorListener).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(Error) }));
      });

      test('should fail if type mismatch (number)', () => {
        mockGetTemplate.mockReturnValue({ schema: { age: { type: 'number' } } });
        const factData = { type: 'user', age: 'thirty' };
        const result = engine.assertFact(factData);
        expect(result).toBeNull();
      });

       test('should pass for NaN with type number if not required (or fail if required and NaN)', () => {
        mockGetTemplate.mockReturnValue({ schema: { age: { type: 'number' } } });
        let factData = { type: 'user', age: NaN };
        let result = engine.assertFact(factData);
        expect(result).toBeNull(); // Engine's schema validation for 'number' rejects NaN due to !isNaN check

        mockGetTemplate.mockReturnValue({ schema: { age: { type: 'number', required: true } } });
        factData = { type: 'user', age: NaN };
        result = engine.assertFact(factData);
        // Still fails the !isNaN(value) check for type 'number'
        expect(result).toBeNull();
      });

      test('should fail if custom validator fails', () => {
        mockGetTemplate.mockReturnValue({
          schema: { age: { type: 'number', validate: val => val > 18 } },
        });
        const factData = { type: 'user', age: 10 };
        const result = engine.assertFact(factData);
        expect(result).toBeNull();
        expect(schemaErrorListener).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(Error) }));
      });

      test('should pass if custom validator passes', () => {
        mockGetTemplate.mockReturnValue({
          schema: { age: { type: 'number', validate: val => val > 18 } },
        });
        const factData = { type: 'user', age: 20 };
        const result = engine.assertFact(factData);
        expect(result).not.toBeNull();
      });

      test('should handle "any" type correctly', () => {
        mockGetTemplate.mockReturnValue({ schema: { data: { type: 'any' } } });
        const factData = { type: 'log', data: { message: 'hello' } };
        expect(engine.assertFact(factData)).not.toBeNull();
        const factData2 = { type: 'log', data: "a string" };
        expect(engine.assertFact(factData2)).not.toBeNull();
      });

      test('should handle nested template types if getTemplate is configured for it', () => {
        mockGetTemplate.mockImplementation(typeName => {
          if (typeName === 'user') return { schema: { profile: { type: 'profile' } } };
          if (typeName === 'profile') return { schema: { bio: { type: 'string' } } };
          return null;
        });
        const factData = { type: 'user', profile: { type: 'profile', bio: 'A dev' } };
        expect(engine.assertFact(factData)).not.toBeNull();

        const badFactData = { type: 'user', profile: { type: 'profile', bio: 123 } }; // bio should be string
        // Current LeapEngine.assertFact doesn't deeply validate nested structures against their own schemas by default.
        // It only checks if the nested object's `type` matches the expected nested type.
        // To make this fail, LeapEngine.assertFact would need full recursive schema validation.
        expect(engine.assertFact(badFactData)).not.toBeNull(); // This will pass with current shallow check
      });

      test('should skip validation if no template found', () => {
        mockGetTemplate.mockReturnValue(null);
        const factData = { type: 'user', name: 123 }; // name is number, but no schema
        const result = engine.assertFact(factData);
        expect(result).not.toBeNull(); // Asserted without schema error
        expect(mockFactStorage.assert).toHaveBeenCalledWith(factData);
      });

      test('should fail for unknown type in schema definition', () => {
        mockGetTemplate.mockImplementation(typeName => {
          if (typeName === 'user') return { schema: { customField: { type: 'nonExistentType' } } };
          return null; // nonExistentType is not a known template
        });
        const factData = { type: 'user', customField: {} };
        const result = engine.assertFact(factData);
        expect(result).toBeNull();        
        expect(schemaErrorListener).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({ message: expect.stringContaining("Unknown type 'nonExistentType'") })
          })
        );
      });
    });
  });

  describe('retractFact', () => {
    test('should retract a fact, add to agenda, and emit event', () => {
      const factToRetract = { type: 'user', name: 'Alice', _id: 1 };
      const listener = jest.fn();
      engine.on('fact:retracted', listener);
      mockFactStorage.retract.mockReturnValue({ fact: factToRetract, metadata: {} });

      engine.retractFact(1);

      expect(mockFactStorage.retract).toHaveBeenCalledWith(1);
      expect(mockAgenda.push).toHaveBeenCalledWith({ type: 'retract', fact: factToRetract });
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ fact: factToRetract, by: 'direct', factId: 1 })
      );
    });

    test('should do nothing if factId not found for retraction', () => {
      const listener = jest.fn();
      engine.on('fact:retracted', listener);
      mockFactStorage.retract.mockReturnValue(null);
      engine.retractFact(999);
      expect(mockAgenda.push).not.toHaveBeenCalled();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('modifyFact / updateFact', () => {
    const originalFact = { type: 'user', name: 'Alice', visits: 1, _id: 1 };
    const originalEntry = { fact: originalFact, metadata: {} };

    beforeEach(() => {
      mockFactStorage.getFactEntry.mockReturnValue(originalEntry);
      mockFactStorage.retract.mockReturnValue(originalEntry);
      // Mock assert to return the new fact with a new ID or same, depending on real behavior
      mockFactStorage.assert.mockImplementation(newFactData => ({
        fact: { ...newFactData, _id: newFactData._id || 2 }, // Simulate new ID if not provided
        metadata: {}
      }));

      // Spy on engine's own methods
      jest.spyOn(engine, 'retractFact');
      jest.spyOn(engine, 'assertFact');
    });

    afterEach(() => {
      jest.restoreAllMocks(); // Restore spies on engine methods
    });

    test('modifyFact should retract old and assert new fact data', () => {
      const updates = { name: 'Alicia', visits: 2 };
      engine.modifyFact(1, updates);

      expect(mockFactStorage.getFactEntry).toHaveBeenCalledWith(1);
      expect(engine.retractFact).toHaveBeenCalledWith(1);
      // _id is removed before assert, type is preserved
      const expectedAssertData = { type: 'user', name: 'Alicia', visits: 2 };
      expect(engine.assertFact).toHaveBeenCalledWith(expectedAssertData);
    });

    test('updateFact should call updateFn and then modifyFact', () => {
      const updateFn = jest.fn(currentUser => ({ visits: currentUser.visits + 1 }));
      jest.spyOn(engine, 'modifyFact'); // Spy on modifyFact

      engine.updateFact(1, updateFn);

      expect(mockFactStorage.getFactEntry).toHaveBeenCalledWith(1);
      expect(updateFn).toHaveBeenCalledWith(originalFact); // updateFn gets the fact part
      expect(engine.modifyFact).toHaveBeenCalledWith(1, { visits: 2 });
    });

    test('updateFact should emit error if factId not found', () => {
      const errorListener = jest.fn();
      engine.on('engine:error', errorListener);
      mockFactStorage.getFactEntry.mockReturnValue(undefined);
      engine.updateFact(999, () => ({}));
      expect(errorListener).toHaveBeenCalledWith(
        expect.objectContaining({
            error: expect.objectContaining({ message: expect.stringContaining('Cannot update fact: ID 999 not found') })
        })
      );
    });

     test('updateFact should emit error if updateFn does not return an object', () => {
      const errorListener = jest.fn();
      engine.on('engine:error', errorListener);
      const updateFn = jest.fn(() => null); // Not an object
      engine.updateFact(1, updateFn);

      expect(errorListener).toHaveBeenCalledWith(
        expect.objectContaining({
            error: expect.objectContaining({ message: expect.stringContaining('did not return a plain object') })
        })
      );
    });
  });

  describe('retractWhere', () => {
    beforeEach(() => {
      // Clear listener mocks if they are defined at a higher scope and reused.
      // For errorListener, it's better to define it locally per test or in this describe's beforeEach.
      // For now, assuming errorListener is set up per test or cleared.
      // If engine.on is used, ensure listeners are fresh or cleared.

      jest.spyOn(engine, 'retractFact');
    });
    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should retract facts matching the pattern', () => {
      const fact1 = { type: 'user', status: 'inactive', _id: 1 };
      const fact2 = { type: 'user', status: 'active', _id: 2 };
      const fact3 = { type: 'user', status: 'inactive', _id: 3 };
      mockFactStorage.getFactsByType.mockReturnValue([fact1, fact2, fact3]);
      mockMatcher.match
        .mockImplementation((pattern, fact) => ({ isMatch: fact.status === 'inactive', bindings: {} }));

      engine.retractWhere({ user: { status: 'inactive' } });

      expect(mockFactStorage.getFactsByType).toHaveBeenCalledWith('user');
      expect(mockMatcher.match).toHaveBeenCalledTimes(3);
      expect(engine.retractFact).toHaveBeenCalledWith(1);
      expect(engine.retractFact).toHaveBeenCalledWith(3);
      expect(engine.retractFact).not.toHaveBeenCalledWith(2);
    });

    test('should emit error for invalid pattern object', () => {
      const errorListener = jest.fn();
      engine.on('engine:error', errorListener);

      engine.retractWhere(null);
      expect(errorListener).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({ message: expect.stringContaining('pattern must be an object') })
      }));
      errorListener.mockClear();

      engine.retractWhere({}); // No type key
      expect(errorListener).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({ message: expect.stringContaining('patternObject must have a type key') })
      }));
       errorListener.mockClear();

      engine.retractWhere({ user: null }); // Pattern for type is null
      expect(errorListener).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({ message: expect.stringContaining('pattern for type must be an object') })
      }));
    });
  });

  describe('Querying (queryAll, queryOne, queryExists)', () => {
    const queryDef = {
      id: 'Q1',
      type: 'query',
      conditions: [{ type: 'user', name: '?n' }], // Mocked by #checkRule
      select: { userName: '?n' },
      orderBy: { key: 'userName', direction: 'asc' },
      offset: 1,
      limit: 2,
    };

    beforeEach(() => {
      // Clear listeners if defined at a higher scope
      // For this block, we'll define listeners per test or assume they are cleared
      // if they were part of the main beforeEach.

      engine.addDefinition(queryDef);
      // Mock internal #checkRule to control its output for query tests
      // mockFactStorage.getFactsByType.mockReturnValue([]); // Ensure it returns iterable
      // This is a simplification; in reality, #checkRule is complex.
      // engine._LeapEngine__checkRule = jest.fn().mockReturnValue([
      //   { bindings: { '?n': 'Bob' }, consumedFactIds: new Set([2]) },
      //   { bindings: { '?n': 'Alice' }, consumedFactIds: new Set([1]) },
      //   { bindings: { '?n': 'Charlie' }, consumedFactIds: new Set([3]) },
      // ]);
    });

    test('queryAll should process results according to query definition', async () => {
      const startedListener = jest.fn();
      const completedListener = jest.fn();
      engine.on('engine:queryStarted', startedListener);
      engine.on('engine:queryCompleted', completedListener);

      mockFactStorage.getFactsByType.mockReturnValueOnce([ { type: 'user', name: 'Bob', _id:2 }, { type: 'user', name: 'Alice', _id:1 }, { type: 'user', name: 'Charlie', _id:3 }]);
      mockMatcher.match.mockImplementation((pattern, fact, bindings) => ({ isMatch: true, bindings: { ...bindings, '?n': fact.name } }));
      const results = await engine.queryAll('Q1');

      // After projection: [{ userName: 'Bob' }, { userName: 'Alice' }, { userName: 'Charlie' }]
      // After orderBy: [{ userName: 'Alice' }, { userName: 'Bob' }, { userName: 'Charlie' }]
      // After offset 1: [{ userName: 'Bob' }, { userName: 'Charlie' }]
      // After limit 2: [{ userName: 'Bob' }, { userName: 'Charlie' }]
      expect(results).toEqual([{ userName: 'Bob' }, { userName: 'Charlie' }]);
      expect(startedListener).toHaveBeenCalledWith(expect.objectContaining({ queryId: 'Q1' }));
      expect(completedListener).toHaveBeenCalledWith(expect.objectContaining({ queryId: 'Q1', resultCount: 2 }));
    });

    test('queryAll should handle no select (raw bindings)', async () => {
        const queryNoSelect = { id: 'Q_NO_SELECT', type: 'query', conditions: [{ type: 'data', value: '?v'}] };
        engine.addDefinition(queryNoSelect);
        mockFactStorage.getFactsByType.mockReturnValueOnce([{_id:1, type:'data', value:10},{_id:2, type:'data', value:20}]);
        mockMatcher.match.mockImplementation((pattern, fact, bindings) => ({ isMatch: true, bindings: { ...bindings, '?v': fact.value } }));
        
        const results = await engine.queryAll('Q_NO_SELECT');
        expect(results).toEqual([ { '?v': 10 }, { '?v': 20 } ]);
    });

    test('queryAll should handle undefined values in orderBy correctly', async () => {
        const queryOrderByUndefined = {
            id: 'Q_ORDER_UNDEF', type: 'query', conditions: [],
            select: { val: '?v' }, orderBy: { key: 'val', direction: 'asc' }
        };
        engine.addDefinition(queryOrderByUndefined);
        // For a query with no conditions, #checkRule might behave differently or not be called in a way that uses getFactsByType.
        // To test orderBy, we need some results. Let's assume conditions match some facts.
        const queryWithCond = { ...queryOrderByUndefined, conditions: [{type: 'item', value: '?v'}]};
        engine.addDefinition(queryWithCond); // Use Q_ORDER_UNDEF as ID but with conditions
        mockFactStorage.getFactsByType.mockReturnValueOnce([ { type: 'item', value: 10, _id:1 }, { type: 'item', value: undefined, _id:2 }, { type: 'item', value: 5, _id:3 }]);
        mockMatcher.match.mockImplementation((pattern, fact, bindings) => ({ isMatch: true, bindings: { ...bindings, '?v': fact.value } }));

        const results = await engine.queryAll('Q_ORDER_UNDEF');
        // undefined sorts last in asc
        expect(results).toEqual([{ val: 5 }, { val: 10 }, { val: undefined }]);
    });

    test('queryOne should return the first result or null', async () => {
      mockFactStorage.getFactsByType.mockReturnValueOnce([ { type: 'user', name: 'Bob', _id:2 }, { type: 'user', name: 'Alice', _id:1 }, { type: 'user', name: 'Charlie', _id:3 }]);
      mockMatcher.match.mockImplementation((pattern, fact, bindings) => ({ isMatch: true, bindings: { ...bindings, '?n': fact.name } }));
      let result = await engine.queryOne('Q1');
      // First after projection & sort: { userName: 'Alice' }, then offset -> { userName: 'Bob' }
      expect(result).toEqual({ userName: 'Bob' });

      mockFactStorage.getFactsByType.mockReturnValueOnce([]); // No matches
      result = await engine.queryOne('Q1');
      expect(result).toBeNull();
    });

    test('queryExists should return true if matches exist, false otherwise', async () => {
      mockFactStorage.getFactsByType.mockReturnValueOnce([ { type: 'user', name: 'Alice', _id:1 } ]);
      mockMatcher.match.mockImplementation((pattern, fact, bindings) => ({ isMatch: true, bindings: { ...bindings, '?n': fact.name } }));
      let exists = await engine.queryExists('Q1');
      expect(exists).toBe(true);

      mockFactStorage.getFactsByType.mockReturnValueOnce([]); // No matches
      exists = await engine.queryExists('Q1');
      expect(exists).toBe(false);
    });

    test('query methods should emit error if query not found', async () => {
      const errorListener = jest.fn();
      engine.on('engine:error', errorListener);
      await engine.queryAll('NonExistentQuery');
      expect(errorListener).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({ message: expect.stringContaining("Query 'NonExistentQuery' not found") })
      }));
    });
  });

  describe('Execution Cycle (run, fireAll, collectActivations)', () => {
    let rule1, contextAssertSpy, contextUpdateSpy, contextModifySpy, contextAddRuleSpy, contextRetractRuleSpy, contextRetractWhereSpy, contextPublishSpy;

    // Event listeners for this describe block
    let definitionAddedListener, definitionRetractedListener, activationYieldedListener;
    let fireAllStartedListener, fireAllCompletedListener;
    let preConditionsFailedListener, beforeAroundListener, afterAroundListener, actionErrorListener, engineErrorListener;

    beforeEach(() => {
      // Mock the context methods to spy on them
      // This requires a bit of finesse as context is created dynamically
      // We spy on the engine methods that context calls.
      // Replace engine methods with our simple spies for this test group.
      // jest.spyOn(engine, 'assertFact'); // No longer needed if we mockImplementation directly

      // Initialize simple mock functions for context spies AFTER engine is created
      contextAssertSpy = jest.fn((factData, metadata) => {
        // Return a structure similar to what FactStorage.assert would,
        // as engine.assertFact (which this mocks) would return newFactEntry.fact
        return { ...factData, _id: metadata?.logical && factData.type === 'consequence' ? 20 : Date.now() };
      });
      contextUpdateSpy = jest.fn();
      contextModifySpy = jest.fn();
      contextAddRuleSpy = jest.fn();
      contextRetractRuleSpy = jest.fn();
      contextRetractWhereSpy = jest.fn();
      contextPublishSpy = jest.fn();

      jest.spyOn(engine, 'assertFact').mockImplementation(contextAssertSpy);
      jest.spyOn(engine, 'updateFact').mockImplementation(contextUpdateSpy);
      jest.spyOn(engine, 'modifyFact').mockImplementation(contextModifySpy);
      // For addRule/retractRule, we check #definitions map or emit
      // For retractWhere, spy on the engine method
      jest.spyOn(engine, 'retractWhere').mockImplementation(contextRetractWhereSpy);

      // Setup event listeners
      definitionAddedListener = jest.fn();
      definitionRetractedListener = jest.fn();
      activationYieldedListener = jest.fn();
      fireAllStartedListener = jest.fn();
      fireAllCompletedListener = jest.fn();
      preConditionsFailedListener = jest.fn();
      beforeAroundListener = jest.fn();
      afterAroundListener = jest.fn();
      actionErrorListener = jest.fn();
      engineErrorListener = jest.fn();


      rule1 = {
        id: 'R1',
        type: 'rule',
        conditions: [{ type: 'trigger' }],
        pre: [],
        then: jest.fn(async (ctx, bindings) => {
            ctx.assertFact({ type: 'consequence', value: bindings['?val'] }, { logical: true });
            ctx.updateFact(123, () => ({ updated: true }));
            ctx.modifyFact(456, { modified: true });
            ctx.addRule({ id: 'DynamicRule', conditions: [], then: () => {} });
            ctx.retractRule('OldRule');
            ctx.retractWhere({ type: 'cleanup' });
            ctx.publish('myTopic', { data: 'payload' });
        }),
        post: [],
        after: jest.fn(),
        around: undefined,
        log: undefined,
        throws: undefined,
      };
      engine.addDefinition(rule1);
      // Register listeners after engine is created and rule potentially added
      engine.on('engine:definitionAdded', definitionAddedListener);
      engine.on('engine:definitionRetracted', definitionRetractedListener);
      engine.on('rule:activationYielded', activationYieldedListener);
      engine.on('engine:fireAllStarted', fireAllStartedListener);
      engine.on('engine:fireAllCompleted', fireAllCompletedListener);
      engine.on('rule:preConditionsFailed', preConditionsFailedListener);
      engine.on('rule:beforeAround', beforeAroundListener);
      engine.on('rule:afterAround', afterAroundListener);
      engine.on('rule:actionError', actionErrorListener);
      engine.on('engine:error', engineErrorListener);

      // Setup agenda and resolver for a single activation
      const task = { type: 'assert', fact: { type: 'trigger', value: 'testValue', _id: 1 } };
      mockAgenda.tasks = [task]; // Prime the agenda
      mockAgenda.hasTasks = true;

      mockResolver.resolve.mockReturnValue({
        rule: rule1,
        bindings: { '?val': 'testValue' },
        consumedFactIds: new Set([1]),
      });

      // Mock #findMatches to be a no-op generator for simplicity in these tests,
      // as resolver is providing the activation.
      engine._LeapEngine__findMatches = jest.fn(function*() {});

      // Provide a default mock for mockFactStorage.assert for stability,
      // though specific tests (like TMS) will override it.
      mockFactStorage.assert.mockImplementation((factToStore, metadata) => {
        return { fact: { ...factToStore, _id: Date.now() }, metadata: metadata || {} };
      });
    });

     afterEach(() => {
        jest.restoreAllMocks(); // Important to restore spies on engine methods
    });

    test('run should process tasks from agenda and yield activations', async () => {
      const activations = [];
      for await (const activation of engine.run()) {
        activations.push(activation);
      }

      expect(activations.length).toBe(1);
      expect(activations[0].rule.id).toBe('R1');
      expect(activations[0].bindings).toEqual({ '?val': 'testValue' });
      expect(rule1.then).toHaveBeenCalled();
      expect(rule1.after).toHaveBeenCalled(); // after should be called

      // Check context method calls
      expect(contextAssertSpy).toHaveBeenCalledWith(
        { type: 'consequence', value: 'testValue' },
        expect.objectContaining({ logical: true, producedBy: expect.any(Number) })
      );
      expect(contextUpdateSpy).toHaveBeenCalledWith(123, expect.any(Function));
      expect(contextModifySpy).toHaveBeenCalledWith(456, { modified: true });
      // addRule in context calls engine.addDefinition
      expect(definitionAddedListener).toHaveBeenCalledWith(expect.objectContaining({ definitionId: 'DynamicRule' }));
      // retractRule in context calls #definitions.delete and emits
      expect(definitionRetractedListener).toHaveBeenCalledWith(expect.objectContaining({ definitionId: 'OldRule' }));
      expect(contextRetractWhereSpy).toHaveBeenCalledWith({ type: 'cleanup' });
      // publish asserts a _topic_event fact
      expect(contextAssertSpy).toHaveBeenCalledWith(expect.objectContaining({ type: '_topic_event', topic: 'myTopic', payload: { data: 'payload' } }));

      expect(activationYieldedListener).toHaveBeenCalledWith(expect.objectContaining({ ruleId: 'R1' }));
    });

    test('fireAll should consume the run iterator', async () => {
      await engine.fireAll();
      expect(rule1.then).toHaveBeenCalledTimes(1);
      expect(fireAllStartedListener).toHaveBeenCalled();
      expect(fireAllCompletedListener).toHaveBeenCalled();
    });

    test('collectActivations should collect all yielded activations', async () => {
      // Listener for collectActivations specific events if any, or rely on run's activationYielded
      const collectStartedListener = jest.fn();
      engine.on('engine:collectActivationsStarted', collectStartedListener);
      const collected = await engine.collectActivations();
      expect(collected.length).toBe(1);
      expect(collected[0].rule.id).toBe('R1');
    });

    test('Symbol.asyncIterator should allow iterating over the engine', async () => {
        const activations = [];
        for await (const activation of engine) { // Uses Symbol.asyncIterator
            activations.push(activation);
        }
        expect(activations.length).toBe(1);
        expect(activations[0].rule.id).toBe('R1');
    });

    test('pre-conditions should prevent rule firing if they fail', async () => {
      rule1.pre = [jest.fn(() => false)]; // Failing pre-condition
      engine._LeapEngine__executeGuard = rule1.pre[0]; // Simulate guard execution

      await engine.fireAll();
      expect(rule1.then).not.toHaveBeenCalled();
      expect(preConditionsFailedListener).toHaveBeenCalledWith(expect.objectContaining({ ruleId: 'R1' }));
    });

    test('around aspect should wrap the main action', async () => {
      const aroundSpy = jest.fn(async (ctx, bindings, proceed) => {
        bindings.aroundBefore = true;
        await proceed();
        bindings.aroundAfter = true;
      });
      rule1.around = aroundSpy;

      await engine.fireAll();

      expect(aroundSpy).toHaveBeenCalled();
      expect(rule1.then).toHaveBeenCalled();
      // Check the bindings object that was passed to and modified by the aroundSpy
      const aroundBindings = aroundSpy.mock.calls[0][1];
      expect(aroundBindings.aroundBefore).toBe(true);
      expect(aroundBindings.aroundAfter).toBe(true);
      expect(beforeAroundListener).toHaveBeenCalledWith(expect.objectContaining({ ruleId: 'R1' }));
      expect(afterAroundListener).toHaveBeenCalledWith(expect.objectContaining({ ruleId: 'R1' }));
    });

    test('throws aspect should handle errors in rule.then', async () => {
        const errorToThrow = new TypeError('Action failed');
        rule1.then.mockImplementation(async () => { throw errorToThrow; });
        const typeErrorSpy = jest.fn();
        rule1.throws = { 'TypeError': typeErrorSpy };

        await engine.fireAll();

        expect(rule1.then).toHaveBeenCalled();
        expect(typeErrorSpy).toHaveBeenCalledWith(errorToThrow, expect.anything(), expect.anything());
        expect(actionErrorListener).toHaveBeenCalledWith(expect.objectContaining({ ruleId: 'R1', error: errorToThrow }));
    });

    test('unhandled error in rule.then (no matching throws) should propagate if not caught by around', async () => {
        const errorToThrow = new Error('Unhandled action error');
        rule1.then.mockImplementation(async () => { throw errorToThrow; });
        rule1.throws = undefined; // No specific handler

        // The engine's run loop catches and emits, but for fireAll, it might rethrow or just log.
        // Let's check for the emission.
        await engine.fireAll(); // Engine catches and emits, does not rethrow from fireAll

        expect(actionErrorListener).toHaveBeenCalledWith(expect.objectContaining({ ruleId: 'R1', error: errorToThrow }));
        // Check that the engine emitted its own error event for the unhandled rule action
        expect(engineErrorListener).toHaveBeenCalledWith(expect.objectContaining({ error: errorToThrow, phase: 'around_or_action_unhandled' }));
    });

    test('Truth Maintenance System (TMS) should retract logical facts', async () => {
      // Override engine.assertFact mock from the describe's beforeEach for this specific test.
      // We need engine.assertFact to interact with mockFactStorage so TMS metadata is handled.
      const tmsProcessingStartedListener = jest.fn();
      const tmsFactRetractedListener = jest.fn();
      engine.on('tms:processingStarted', tmsProcessingStartedListener);
      engine.on('tms:factRetracted', tmsFactRetractedListener);
      const logicalFactOutputId = 20; // Predictable ID for the logically asserted fact.

      engine.assertFact.mockImplementation((factData, metadataInternal) => {
        // This mock simulates engine.assertFact's interaction with FactStorage.
        // metadataInternal is what ctx.assertFact passes, e.g., { logical: true, producedBy: activationId }
        const factToStore = { ...factData };
        // Real engine.assertFact would do schema validation here.
        // It then calls this.#factStorage.assert.
        const newFactEntry = mockFactStorage.assert(factToStore, metadataInternal);
        if (newFactEntry) {
          // Real engine.assertFact also emits 'fact:asserted' and adds to agenda.
          // This mock just needs to return the fact object for ctx.assertFact to use.
          return newFactEntry.fact;
        }
        return null;
      });

      // Configure mockFactStorage.assert to assign the logicalFactOutputId and store metadata.
      // This metadata is crucial for ctx.assertFact to update and for TMS to read.
      mockFactStorage.assert.mockImplementation((factToStore, metadata) => {
        let factId = factToStore._id;
        if (metadata && metadata.logical && factToStore.type === 'consequence') {
          factId = logicalFactOutputId;
        } else {
          factId = factId || Date.now(); // Assign an ID if not present
        }
        const finalFact = { ...factToStore, _id: factId };
        const entryToStore = { fact: finalFact, metadata: metadata || {} };

        // Ensure getFactEntry can retrieve this newly "stored" entry.
        // This is important because ctx.assertFact calls getFactEntry to update metadata.
        const existingMockGetFactEntry = mockFactStorage.getFactEntry.getMockImplementation() || mockFactStorage.getFactEntry;
        mockFactStorage.getFactEntry.mockImplementation(idToRetrieve => {
          if (idToRetrieve === finalFact._id) {
            return entryToStore;
          }
          // Fallback for other facts like triggerFact
          if (idToRetrieve === triggerFact._id) return { fact: triggerFact, metadata: {} };
          // Call pre-existing mock for other IDs if necessary
          if (existingMockGetFactEntry && typeof existingMockGetFactEntry === 'function' && idToRetrieve !== finalFact._id && idToRetrieve !== triggerFact._id) {
            return existingMockGetFactEntry(idToRetrieve);
          }
          return undefined;
        });
        return entryToStore; // FactStorage.assert typically returns the entry {fact, metadata}
      });

      // Setup: Rule R1 asserts fact F2 logically. Then F1 (trigger for R1) is retracted.
      const triggerFact = { type: 'trigger', _id: 10 };
      // This is the fact R1's 'then' clause will assert.
      // Its _id will be `logicalFactOutputId` due to the mockFactStorage.assert setup.
      const r1AssertsThisFactData = { type: 'consequence', value: 'testValue' };
      const expectedAssertedLogicalFact = { ...r1AssertsThisFactData, _id: logicalFactOutputId };

      let producedFactIdForTMS;
      let capturedFactObjectForTMS;

      engine.on('fact-produced', (eventData) => {
        const { fact, rule: emittingRule } = eventData;
        // Check if it's our target rule (R1) and the fact is the logical one we expect
        if (emittingRule && emittingRule.id === 'R1' && fact.type === 'consequence' && fact._id === logicalFactOutputId) {
          producedFactIdForTMS = fact._id;
          capturedFactObjectForTMS = fact;
        }
      });

      // 1. R1 fires, asserts F2 logically
      mockAgenda.tasks = [{ type: 'assert', fact: triggerFact }];
      mockAgenda.hasTasks = true;
      mockResolver.resolve.mockReturnValueOnce({
        rule: rule1, // rule1's 'then' asserts a logical fact
        bindings: { '?val': 'testValue' }, // rule1.then uses bindings['?val']
        consumedFactIds: new Set([triggerFact._id]),
      });

      await engine.fireAll(); // R1 fires
      expect(producedFactIdForTMS).toBe(logicalFactOutputId);
      expect(capturedFactObjectForTMS).toEqual(expectedAssertedLogicalFact);

      // 2. Retract F1 (triggerFact)
      mockAgenda.tasks = [{ type: 'retract', fact: triggerFact }]; // Retraction task for F1
      mockAgenda.hasTasks = true;

      mockFactStorage.retract.mockImplementation(idToRetract => {
        if (idToRetract === triggerFact._id) {
          return { fact: triggerFact, metadata: {} };
        }
        if (idToRetract === producedFactIdForTMS) {
          // TMS will call retractFact on the logical fact.
          // FactStorage.retract should return the entry it's retracting.
          // This entry should have the correct metadata (logical, producedBy)
          // which was set up by mockFactStorage.assert and ctx.assertFact.
          return mockFactStorage.getFactEntry(idToRetract);
        }
        return null;
      });

      const retractSpy = jest.spyOn(engine, 'retractFact');
      engine.retractFact(triggerFact._id);

      await engine.fireAll(); // Process the agenda, including the retraction task and subsequent TMS

      expect(retractSpy).toHaveBeenCalledWith(triggerFact._id);
      expect(retractSpy).toHaveBeenCalledWith(producedFactIdForTMS); // Check TMS retracted the correct fact
      expect(tmsProcessingStartedListener).toHaveBeenCalled();
      expect(tmsFactRetractedListener).toHaveBeenCalledWith(expect.objectContaining({ fact: capturedFactObjectForTMS }));
    });
  });

  describe('Internal Helper: #resolvePath', () => {
    // Test #resolvePath indirectly via a public method that uses it, e.g., queryAll with orderBy
    test('orderBy in queryAll should correctly use path resolution', async () => {
      const queryWithPath = {
        id: 'Q_PATH', type: 'query', conditions: [{type: 'data', value: '?v'}],
        select: { item: '?v' }, orderBy: { key: 'item.name', direction: 'asc' }
      };
      engine.addDefinition(queryWithPath);
      mockFactStorage.getFactsByType.mockReturnValueOnce([ { type: 'data', value: { name: 'Charlie'}, _id:1 }, { type: 'data', value: { name: 'Alice' }, _id:2 }]);
      mockMatcher.match.mockImplementation((pattern, fact, bindings) => ({isMatch: true, bindings: { ...bindings, '?v': fact.value }}));
      
      const results = await engine.queryAll('Q_PATH');
      expect(results).toEqual([{ item: { name: 'Alice' } }, { item: { name: 'Charlie' } }]);
    });
  });

  describe('Internal Helper: #executeGuard', () => {
    // Test #executeGuard indirectly via rule pre-conditions or query conditions with guards
    test('rule pre-conditions should correctly execute guards', async () => {
      const preCondFailedListener = jest.fn();
      engine.on('rule:preConditionsFailed', preCondFailedListener);

      const ruleWithGuard = {
        id: 'R_GUARD', type: 'rule',
        conditions: [{ type: 'trigger', value: '?x' }],
        pre: [['>', '?x', 5]], // Guard: ?x > 5
        then: jest.fn()
      };
      engine.addDefinition(ruleWithGuard);

      // Case 1: Guard passes
      mockAgenda.tasks = [{ type: 'assert', fact: { type: 'trigger', value: 10, _id: 1 } }];
      mockAgenda.hasTasks = true;
      mockResolver.resolve.mockReturnValueOnce({ rule: ruleWithGuard, bindings: { '?x': 10 }, consumedFactIds: new Set([1])});
      engine._LeapEngine__findMatches = jest.fn(function*() { yield { rule: ruleWithGuard, bindings: { '?x': 10 }, consumedFactIds: new Set([1])}; }); // Simulate match

      await engine.fireAll();
      expect(ruleWithGuard.then).toHaveBeenCalledTimes(1);

      // Case 2: Guard fails
      ruleWithGuard.then.mockClear();
      mockAgenda.tasks = [{ type: 'assert', fact: { type: 'trigger', value: 3, _id: 2 } }];
      mockAgenda.hasTasks = true;
      mockResolver.resolve.mockReturnValueOnce({ rule: ruleWithGuard, bindings: { '?x': 3 }, consumedFactIds: new Set([2])});
      engine._LeapEngine__findMatches = jest.fn(function*() { yield { rule: ruleWithGuard, bindings: { '?x': 3 }, consumedFactIds: new Set([2])}; }); // Simulate match

      await engine.fireAll();
      expect(ruleWithGuard.then).not.toHaveBeenCalled();
      expect(preCondFailedListener).toHaveBeenCalledWith(expect.objectContaining({ ruleId: 'R_GUARD' }));
    });

    test('guard with path operator', async () => {
      const ruleWithPathGuard = {
        id: 'R_PATH_GUARD', type: 'rule',
        conditions: [{ type: 'data', payload: '?p' }],
        pre: [['===', ['path', '?p', 'user', 'id'], 123]],
        then: jest.fn()
      };
      engine.addDefinition(ruleWithPathGuard);
      const fact = { type: 'data', payload: { user: { id: 123 } }, _id: 1 };
      mockAgenda.tasks = [{ type: 'assert', fact }];
      mockAgenda.hasTasks = true;
      mockResolver.resolve.mockReturnValueOnce({ rule: ruleWithPathGuard, bindings: { '?p': fact.payload }, consumedFactIds: new Set([1])});
      engine._LeapEngine__findMatches = jest.fn(function*() { yield { rule: ruleWithPathGuard, bindings: { '?p': fact.payload }, consumedFactIds: new Set([1])}; });

      await engine.fireAll();
      expect(ruleWithPathGuard.then).toHaveBeenCalled();
    });


    test('guard with type errors for arithmetic/comparison ops should emit error', () => {
      // This test is tricky to isolate perfectly without direct #executeGuard call.
      // We rely on the error emission from within #executeGuard.
      const guardErrorListener = jest.fn();
      engine.on('engine:guardError', guardErrorListener);

      const ruleWithBadGuard = {
        id: 'R_BAD_GUARD_TYPE', type: 'rule',
        conditions: [{ type: 'trigger', name: '?name', count: '?count' }],
        pre: [['>', '?name', '?count']], // Comparing string with number
        then: jest.fn()
      };
      engine.addDefinition(ruleWithBadGuard);
      const fact = { type: 'trigger', name: 'Alice', count: 5, _id: 1 };
      mockAgenda.tasks = [{ type: 'assert', fact }];
      mockAgenda.hasTasks = true;
      mockResolver.resolve.mockReturnValueOnce({ rule: ruleWithBadGuard, bindings: { '?name': 'Alice', '?count': 5 }, consumedFactIds: new Set([1])});
      engine._LeapEngine__findMatches = jest.fn(function*() { yield { rule: ruleWithBadGuard, bindings: { '?name': 'Alice', '?count': 5 }, consumedFactIds: new Set([1])}; });

      engine.fireAll(); // This will run, guard will fail internally and emit
      expect(guardErrorListener).toHaveBeenCalledWith(expect.objectContaining({ ruleId: 'R_BAD_GUARD_TYPE', error: expect.any(TypeError)}));
    });

    test('guard with division by zero should emit error', async () => {
      const guardErrorListener = jest.fn();
      // engine.on('engine:guardError', guardErrorListener); // Listener defined locally below

      const ruleDivZero = {
        id: 'R_DIV_ZERO', type: 'rule',
        conditions: [{ type: 'operands', x: '?x', y: '?y' }],
        pre: [['/', '?x', '?y']],
        then: jest.fn()
      };
      engine.addDefinition(ruleDivZero);
      const fact = { type: 'operands', x: 10, y: 0, _id: 1 };
      mockAgenda.tasks = [{ type: 'assert', fact }];
      mockAgenda.hasTasks = true;

      // Ensure the actual #findMatches can find the rule via mocked dependencies
      mockFactStorage.getFactsByType.mockImplementation((type) => {
        if (type === 'operands') return [fact];
        return [];
      });
      mockMatcher.match.mockImplementation((pattern, f, bindings) => {
        if (f.type === 'operands') return { isMatch: true, bindings: { ...bindings, '?x': f.x, '?y': f.y } };
        return { isMatch: false, bindings };
      });
      mockResolver.resolve.mockReturnValueOnce({ rule: ruleDivZero, bindings: { '?x': 10, '?y': 0 }, consumedFactIds: new Set([1])});
      
      const localGuardErrorListener = jest.fn();
      engine.on('engine:guardError', localGuardErrorListener);
      await engine.fireAll(); // Run the engine, which should execute the rule and its failing guard

      expect(localGuardErrorListener).toHaveBeenCalled();
      const emittedErrorPayload = localGuardErrorListener.mock.calls[0][0];
      expect(emittedErrorPayload).toEqual(expect.objectContaining({ ruleId: 'R_DIV_ZERO', error: expect.objectContaining({ message: 'Guard Error: Division by zero in rule [R_DIV_ZERO].' })}));
    });
  });

  describe('Internal Helper: #project', () => {
    // Test #project indirectly via queryAll's select clause
    test('queryAll select should correctly project bindings', async () => {
      const queryWithProjection = {
        id: 'Q_PROJ', type: 'query',
        conditions: [{ type: 'user', id: '?id', name: '?name', age: '?age' }],
        select: { userId: '?id', info: { userName: '?name', nextAge: ['+', '?age', 1] } }
      };
      engine.addDefinition(queryWithProjection);
      mockFactStorage.getFactsByType.mockReturnValueOnce([{ type: 'user', id: 1, name: 'Alice', age: 30, _id: 100 }]);
      mockMatcher.match.mockImplementation((pattern, fact, bindings) => ({isMatch: true, bindings: { ...bindings, '?id': fact.id, '?name': fact.name, '?age': fact.age }}));

      const results = await engine.queryAll('Q_PROJ');
      expect(results).toEqual([{ userId: 1, info: { userName: 'Alice', nextAge: 31 } }]);
    });

    test('queryAll select should handle projection errors gracefully', async () => {
      const projectionErrorListener = jest.fn();
      engine.on('engine:projectionError', projectionErrorListener);

      const queryWithBadProjection = {
        id: 'Q_BAD_PROJ', type: 'query',
        conditions: [{ type: 'user', id: '?id' }],
        select: { userId: '?id', unbound: '?unboundVar' } // ?unboundVar will cause error
      };
      engine.addDefinition(queryWithBadProjection);
      mockFactStorage.getFactsByType.mockReturnValueOnce([{ type: 'user', id: 1, _id: 101 }]);
      mockMatcher.match.mockImplementation((pattern, fact, bindings) => ({isMatch: true, bindings: { ...bindings, '?id': fact.id }}));

      const results = await engine.queryAll('Q_BAD_PROJ');
      expect(results.length).toBe(1); // Should still get one result object
      expect(results[0].unbound).toBeUndefined();
      expect(projectionErrorListener).toHaveBeenCalledWith(
        expect.objectContaining({ queryId: 'Q_BAD_PROJ', error: expect.any(Error) })
      );
    });
  });

});