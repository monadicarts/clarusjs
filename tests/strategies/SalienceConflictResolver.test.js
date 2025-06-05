// test/strategies/SalienceConflictResolver.test.js
import { SalienceConflictResolver } from '../../src/strategies/SalienceConflictResolver';

describe('SalienceConflictResolver', () => {
  let resolver;

  beforeEach(() => {
    resolver = new SalienceConflictResolver();
  });

  function* createMatchIterator(activations) {
    for (const activation of activations) {
      yield activation;
    }
  }

  test('should return null if no activations are provided', () => {
    const iterator = createMatchIterator([]);
    expect(resolver.resolve(iterator)).toBeNull();
  });

  test('should return the single activation if only one is provided', () => {
    const activation = { rule: { id: 'rule1', salience: 10 }, bindings: {}, consumedFactIds: new Set() };
    const iterator = createMatchIterator([activation]);
    expect(resolver.resolve(iterator)).toBe(activation);
  });

  test('should select the activation with the highest salience', () => {
    const activation1 = { rule: { id: 'rule1', salience: 10 }, bindings: { a: 1 }, consumedFactIds: new Set([1]) };
    const activation2 = { rule: { id: 'rule2', salience: 20 }, bindings: { b: 2 }, consumedFactIds: new Set([2]) };
    const activation3 = { rule: { id: 'rule3', salience: 5 }, bindings: { c: 3 }, consumedFactIds: new Set([3]) };
    const iterator = createMatchIterator([activation1, activation2, activation3]);
    expect(resolver.resolve(iterator)).toBe(activation2);
  });

  test('should handle negative salience values correctly', () => {
    const activation1 = { rule: { id: 'rule1', salience: -5 }, bindings: {}, consumedFactIds: new Set() };
    const activation2 = { rule: { id: 'rule2', salience: 0 }, bindings: {}, consumedFactIds: new Set() };
    const activation3 = { rule: { id: 'rule3', salience: -10 }, bindings: {}, consumedFactIds: new Set() };
    const iterator = createMatchIterator([activation1, activation2, activation3]);
    expect(resolver.resolve(iterator)).toBe(activation2);
  });

  test('should default salience to 0 if not specified in the rule', () => {
    const activation1 = { rule: { id: 'rule1' }, bindings: { x: 1 }, consumedFactIds: new Set() }; // Salience defaults to 0
    const activation2 = { rule: { id: 'rule2', salience: 10 }, bindings: { y: 2 }, consumedFactIds: new Set() };
    const activation3 = { rule: { id: 'rule3', salience: -5 }, bindings: { z: 3 }, consumedFactIds: new Set() };
    const iterator = createMatchIterator([activation1, activation2, activation3]);
    expect(resolver.resolve(iterator)).toBe(activation2);
  });

  test('should default salience to 0 if salience is not a number', () => {
    const activation1 = { rule: { id: 'rule1', salience: 'high' }, bindings: {}, consumedFactIds: new Set() }; // Invalid, defaults to 0
    const activation2 = { rule: { id: 'rule2', salience: 5 }, bindings: {}, consumedFactIds: new Set() };
    const activation3 = { rule: { id: 'rule3', salience: null }, bindings: {}, consumedFactIds: new Set() }; // Invalid, defaults to 0
    const iterator = createMatchIterator([activation1, activation2, activation3]);
    expect(resolver.resolve(iterator)).toBe(activation2);
  });

  test('should pick the first activation if multiple have the same highest salience (tie-breaking)', () => {
    const activation1 = { rule: { id: 'rule1', salience: 10 }, bindings: { val: 'first' }, consumedFactIds: new Set() };
    const activation2 = { rule: { id: 'rule2', salience: 5 }, bindings: { val: 'second' }, consumedFactIds: new Set() };
    const activation3 = { rule: { id: 'rule3', salience: 10 }, bindings: { val: 'third' }, consumedFactIds: new Set() };
    // Order in array: activation1, activation2, activation3
    // Expected: activation1 because it's the first one with salience 10.
    const iterator = createMatchIterator([activation1, activation2, activation3]);
    expect(resolver.resolve(iterator)).toBe(activation1);

    // Change order to test stability
    const iterator2 = createMatchIterator([activation2, activation3, activation1]);
    // Expected: activation3 because it's now the first one with salience 10 in this new iterator.
    expect(resolver.resolve(iterator2)).toBe(activation3);
  });

  test('should handle a mix of specified, unspecified, and invalid salience values', () => {
    const activationA = { rule: { id: 'A', salience: 100 }, bindings: { data: 'A' }, consumedFactIds: new Set() };
    const activationB = { rule: { id: 'B' }, bindings: { data: 'B' }, consumedFactIds: new Set() }; // Defaults to 0
    const activationC = { rule: { id: 'C', salience: -10 }, bindings: { data: 'C' }, consumedFactIds: new Set() };
    const activationD = { rule: { id: 'D', salience: 'invalid' }, bindings: { data: 'D' }, consumedFactIds: new Set() }; // Defaults to 0
    const activationE = { rule: { id: 'E', salience: 100 }, bindings: { data: 'E' }, consumedFactIds: new Set() };

    const iterator = createMatchIterator([activationB, activationC, activationD, activationA, activationE]);
    // Expected: activationA (first one with salience 100)
    expect(resolver.resolve(iterator)).toBe(activationA);
  });
});
