import { FactStorage } from '../../src/components/FactStorage';

describe('FactStorage', () => {
  let factStorage;

  beforeEach(() => {
    factStorage = new FactStorage();
  });

  describe('assert', () => {
    test('should assert a new fact and assign an _id', () => {
      const fact = { type: 'user', name: 'Alice' };
      const result = factStorage.assert(fact);

      expect(result).not.toBeNull();
      expect(result.fact).toHaveProperty('_id', 1);
      expect(result.fact.type).toBe('user');
      expect(result.fact.name).toBe('Alice');
      expect(result.metadata).toEqual({});
    });

    test('should assert a fact with metadata', () => {
      const fact = { type: 'user', name: 'Bob' };
      const metadata = { source: 'test' };
      const result = factStorage.assert(fact, metadata);

      expect(result).not.toBeNull();
      expect(result.fact).toHaveProperty('_id', 1);
      expect(result.metadata).toEqual(metadata);
    });

    test('should increment _id for subsequent facts', () => {
      factStorage.assert({ type: 'user', name: 'Alice' });
      const result = factStorage.assert({ type: 'product', name: 'Laptop' });

      expect(result.fact).toHaveProperty('_id', 2);
    });

    test('should return null and log error if fact is missing type', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const fact = { name: 'Charlie' };
      const result = factStorage.assert(fact);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "FactStorage Error: Fact must be an object and have a 'type' property of type string."
      );
      consoleErrorSpy.mockRestore();
    });

    test('should return null and log error if fact type is not a string', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const fact = { type: 123, name: 'Dave' };
      const result = factStorage.assert(fact);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "FactStorage Error: Fact must be an object and have a 'type' property of type string."
      );
      consoleErrorSpy.mockRestore();
    });

    test('should return null if fact is null or undefined', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(factStorage.assert(null)).toBeNull();
      expect(factStorage.assert(undefined)).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
      consoleErrorSpy.mockRestore();
    });

    test('should not mutate the original fact object', () => {
      const originalFact = { type: 'user', name: 'Eve' };
      factStorage.assert(originalFact);
      expect(originalFact).not.toHaveProperty('_id');
    });
  });

  describe('getFactEntry', () => {
    test('should retrieve a fact entry by its ID', () => {
      const asserted = factStorage.assert({ type: 'user', name: 'Alice' });
      const retrieved = factStorage.getFactEntry(asserted.fact._id);

      expect(retrieved).toEqual(asserted);
    });

    test('should return undefined if fact ID does not exist', () => {
      expect(factStorage.getFactEntry(999)).toBeUndefined();
    });
  });

  describe('getFactsByType', () => {
    beforeEach(() => {
      factStorage.assert({ type: 'user', name: 'Alice' });
      factStorage.assert({ type: 'user', name: 'Bob' });
      factStorage.assert({ type: 'product', name: 'Laptop' });
    });

    test('should retrieve all facts of a given type', () => {
      const users = Array.from(factStorage.getFactsByType('user'));
      expect(users.length).toBe(2);
      expect(users).toContainEqual(expect.objectContaining({ name: 'Alice', type: 'user' }));
      expect(users).toContainEqual(expect.objectContaining({ name: 'Bob', type: 'user' }));
    });

    test('should return an empty iterator if no facts of that type exist', () => {
      const orders = Array.from(factStorage.getFactsByType('order'));
      expect(orders.length).toBe(0);
    });

    test('should return an empty iterator if type does not exist in alphaNetwork', () => {
      const nonExistent = Array.from(factStorage.getFactsByType('nonExistentType'));
      expect(nonExistent.length).toBe(0);
    });

     test('should return an empty iterator if storage is empty', () => {
      factStorage.clear();
      const users = Array.from(factStorage.getFactsByType('user'));
      expect(users.length).toBe(0);
    });
  });

  describe('retract', () => {
    let fact1, fact2, fact3;

    beforeEach(() => {
      fact1 = factStorage.assert({ type: 'user', name: 'Alice' });
      fact2 = factStorage.assert({ type: 'user', name: 'Bob' });
      fact3 = factStorage.assert({ type: 'product', name: 'Laptop' });
    });

    test('should retract an existing fact by ID', () => {
      const retractedEntry = factStorage.retract(fact1.fact._id);
      expect(retractedEntry).toEqual(fact1);
      expect(factStorage.getFactEntry(fact1.fact._id)).toBeUndefined();

      const users = Array.from(factStorage.getFactsByType('user'));
      expect(users.length).toBe(1);
      expect(users[0]).toEqual(fact2.fact);
    });

    test('should return null if fact ID does not exist for retraction', () => {
      expect(factStorage.retract(999)).toBeNull();
    });

    test('should remove type from alphaNetwork if all facts of that type are retracted', () => {
      factStorage.retract(fact3.fact._id); // Retract the only 'product'
      expect(factStorage.getFactsByType('product').next().done).toBe(true); // Iterator should be empty
      
      // Internal check (not strictly necessary for black-box testing but good for understanding)
      // This checks if the 'product' key is removed from the alphaNetwork map.
      // You might not have direct access to #alphaNetwork in a real test without exposing it,
      // but its effect is testable via getFactsByType.
      // For this example, we assume its effect is what matters.
      const products = Array.from(factStorage.getFactsByType('product'));
      expect(products.length).toBe(0);
    });

    test('should correctly update alphaNetwork when a fact is retracted', () => {
      factStorage.retract(fact1.fact._id);
      let users = Array.from(factStorage.getFactsByType('user'));
      expect(users.length).toBe(1);
      expect(users[0].name).toBe('Bob');

      factStorage.retract(fact2.fact._id);
      users = Array.from(factStorage.getFactsByType('user'));
      expect(users.length).toBe(0);
    });
  });

  describe('clear', () => {
    test('should clear all facts and reset ID counter', () => {
      factStorage.assert({ type: 'user', name: 'Alice' });
      factStorage.assert({ type: 'product', name: 'Laptop' });

      factStorage.clear();

      expect(factStorage.getFactEntry(1)).toBeUndefined();
      expect(Array.from(factStorage.getFactsByType('user')).length).toBe(0);
      expect(Array.from(factStorage.getFactsByType('product')).length).toBe(0);

      // Check if ID counter is reset
      const result = factStorage.assert({ type: 'user', name: 'Charlie' });
      expect(result.fact._id).toBe(1);
    });

    test('clear on an empty storage should not error', () => {
        expect(() => factStorage.clear()).not.toThrow();
        const result = factStorage.assert({ type: 'test', name: 'Test' });
        expect(result.fact._id).toBe(1); // ID should start from 1
    });
  });

  describe('AlphaNetwork Integrity', () => {
    test('alphaNetwork should be correctly populated and depopulated', () => {
      const f1 = factStorage.assert({ type: 'A', val: 1 });
      const f2 = factStorage.assert({ type: 'A', val: 2 });
      const f3 = factStorage.assert({ type: 'B', val: 3 });

      expect(Array.from(factStorage.getFactsByType('A')).length).toBe(2);
      expect(Array.from(factStorage.getFactsByType('B')).length).toBe(1);

      factStorage.retract(f1.fact._id);
      expect(Array.from(factStorage.getFactsByType('A')).length).toBe(1);
      expect(Array.from(factStorage.getFactsByType('A'))[0]).toEqual(f2.fact);

      factStorage.retract(f2.fact._id);
      expect(Array.from(factStorage.getFactsByType('A')).length).toBe(0);

      factStorage.retract(f3.fact._id);
      expect(Array.from(factStorage.getFactsByType('B')).length).toBe(0);
    });
  });
});