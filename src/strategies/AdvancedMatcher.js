/**
 * @file Defines the AdvancedMatcher class for complex pattern matching of rule conditions
 * against facts, and the ANY wildcard symbol.
 * This matcher is a core component of the Clarus.js rule engine.
 * @module strategies/AdvancedMatcher
 */

/**
 * A symbol used as a wildcard in patterns to match any value for a specific field
 * without binding it to a variable.
 * @type {Symbol}
 * @export
 * @example // In a rule's `when` clause:
 * { user: { name: ANY, age: _.gt(18), status: 'active' } }
 * // This pattern matches any user who is active and older than 18, regardless of their name.
 */
export const ANY = Symbol("clarus.any_value_wildcard");

/**
 * Performs advanced, recursive pattern matching of rule conditions (patterns) against facts.
 * It supports:
 * - Literal value matching (strings, numbers, booleans, null, undefined).
 * - Variable binding (e.g., `?name`, `?userAge`).
 * - Predicate functions (typically from the `_` helper object, e.g., `_.gt(10)`).
 * - Array pattern matching, including destructuring with a "rest" operator (e.g., `['?first', '...?restElements', '?last']`).
 * - Object pattern matching for checking specific properties and their values.
 * - The `ANY` wildcard symbol to match any value for a field.
 * @export
 * @class AdvancedMatcher
 */
export class AdvancedMatcher {
  /**
   * Recursively matches a pattern against a fact value, considering existing bindings.
   *
   * @param {*} pattern - The pattern to match against the fact. This can be:
   * - A literal value (string, number, boolean, null, undefined) for exact equality.
   * - A string starting with '?' (e.g., `?userId`) to bind the fact's value to that variable.
   * If the variable is already bound, it checks if the fact's value matches the bound value.
   * - A function (predicate) which will be called with the fact's value; expects a boolean return.
   * - An array, representing an ordered pattern to match against an array fact.
   * - If the pattern array contains a string like `'...?restVar'`, it performs destructuring,
   * binding the remaining elements to `restVar`.
   * - Otherwise, it expects an exact length match and matches elements recursively.
   * - An object, representing a pattern to match against an object fact.
   * It checks for the presence and recursive match of each property defined in the pattern.
   * - The `ANY` symbol, which matches any value without binding.
   * @param {*} fact - The fact data (or part of a fact) to match against the pattern.
   * @param {object} [initialBindings={}] - An object containing variables already bound from
   * previous conditions in the same rule. These bindings are used for consistency checks
   * and are augmented with new bindings found during the current match.
   * @returns {{isMatch: boolean, bindings: object}} An object containing:
   * - `isMatch`: A boolean indicating if the pattern successfully matched the fact.
   * - `bindings`: An object containing all variable bindings accumulated during this
   * match and any `initialBindings` passed in. If `isMatch` is false, bindings may be incomplete.
   *
   * @example
   * const matcher = new AdvancedMatcher();
   * const fact = { type: 'user', name: 'Alice', age: 30, tags: ['vip', 'active'] };
   *
   * // Literal match
   * matcher.match('Alice', fact.name); // { isMatch: true, bindings: {} }
   *
   * // Variable binding
   * matcher.match('?userName', fact.name); // { isMatch: true, bindings: { '?userName': 'Alice' } }
   *
   * // Predicate function
   * const isAdult = (age) => age >= 18;
   * matcher.match(isAdult, fact.age); // { isMatch: true, bindings: {} }
   *
   * // Object pattern
   * matcher.match({ name: '?n', age: _.gt(25) }, fact); // { isMatch: true, bindings: { '?n': 'Alice' } }
   *
   * // Array destructuring
   * matcher.match(['?firstTag', '...?otherTags'], fact.tags);
   * // { isMatch: true, bindings: { '?firstTag': 'vip', 'otherTags': ['active'] } }
   */
  match(pattern, fact, initialBindings = {}) {
    const bindings = { ...initialBindings };

    // 1. ANY Wildcard: Always matches, no new bindings.
    if (pattern === ANY) {
      return { isMatch: true, bindings };
    }

    // 2. Predicate Function: Execute the function with the fact value.
    if (typeof pattern === 'function') {
      try {
        return { isMatch: !!pattern(fact), bindings };
      } catch (e) {
        // Predicate function might throw if fact is not of expected type for it.
        // console.warn("Predicate function threw an error during match:", e);
        return { isMatch: false, bindings };
      }
    }

    // 3. Variable Binding / Consistency Check:
    if (typeof pattern === 'string' && pattern.startsWith('?')) {
      const boundValue = bindings[pattern];
      if (boundValue !== undefined) {
        // Variable already bound, recursively match its current value against the fact.
        // This ensures consistency across a rule's conditions.
        return this.match(boundValue, fact, bindings);
      }
      // Variable not bound yet, bind it to the current fact value.
      bindings[pattern] = fact;
      return { isMatch: true, bindings };
    }

    // 4. Array Pattern Matching (including destructuring with '...')
    if (Array.isArray(pattern)) {
      if (!Array.isArray(fact)) return { isMatch: false, bindings }; // Fact must also be an array.

      const restOperatorIndex = pattern.findIndex(p => typeof p === 'string' && p.startsWith('...'));

      if (restOperatorIndex !== -1) { // Destructuring with a rest operator
        if (pattern.filter(p => typeof p === 'string' && p.startsWith('...')).length > 1) {
          // Multiple rest operators in a single array pattern are ambiguous and not supported.
          // console.warn("AdvancedMatcher: Multiple rest operators (...) in an array pattern are not supported.");
          return { isMatch: false, bindings };
        }

        const headPattern = pattern.slice(0, restOperatorIndex);
        const tailPattern = pattern.slice(restOperatorIndex + 1);
        const restVariableName = pattern[restOperatorIndex]; // e.g., "...?remaining"

        // Fact must be long enough to satisfy head and tail patterns.
        if (fact.length < headPattern.length + tailPattern.length) {
          return { isMatch: false, bindings };
        }

        let currentBindings = { ...bindings };

        // Match head elements
        for (let i = 0; i < headPattern.length; i++) {
          const result = this.match(headPattern[i], fact[i], currentBindings);
          if (!result.isMatch) return { isMatch: false, bindings: result.bindings };
          currentBindings = result.bindings;
        }

        // Match tail elements (from the end of the fact array)
        for (let i = 0; i < tailPattern.length; i++) {
          const factIndex = fact.length - tailPattern.length + i;
          const result = this.match(tailPattern[i], fact[factIndex], currentBindings);
          if (!result.isMatch) return { isMatch: false, bindings: result.bindings };
          currentBindings = result.bindings;
        }

        // Bind the rest elements
        // The variable name for rest is the string after '...' (e.g., from "...?myRest" bind to "?myRest")
        currentBindings[restVariableName.substring(3)] = fact.slice(headPattern.length, fact.length - tailPattern.length);
        return { isMatch: true, bindings: currentBindings };

      } else { // Standard array matching (no rest operator)
        // Expects an exact length match and matches elements recursively.
        if (pattern.length !== fact.length) return { isMatch: false, bindings };

        let currentBindings = { ...bindings };
        for (let i = 0; i < pattern.length; i++) {
          const result = this.match(pattern[i], fact[i], currentBindings);
          if (!result.isMatch) return { isMatch: false, bindings: result.bindings };
          currentBindings = result.bindings;
        }
        return { isMatch: true, bindings: currentBindings };
      }
    }

    // 5. Object Pattern Matching:
    if (typeof pattern === 'object' && pattern !== null && !Array.isArray(pattern)) {
      if (typeof fact !== 'object' || fact === null) return { isMatch: false, bindings }; // Fact must be a non-null object.

      let currentBindings = { ...bindings };
      for (const key in pattern) {
        if (!Object.prototype.hasOwnProperty.call(pattern, key)) continue; // Iterate own properties of pattern

        // Fact must have the property defined in the pattern.
        if (!Object.prototype.hasOwnProperty.call(fact, key)) {
          return { isMatch: false, bindings: currentBindings }; // Return currentBindings as they were before this key failed
        }

        const result = this.match(pattern[key], fact[key], currentBindings);
        if (!result.isMatch) return { isMatch: false, bindings: result.bindings };
        currentBindings = result.bindings;
      }
      return { isMatch: true, bindings: currentBindings };
    }

    // 6. Primitive Value Equality (covers strings, numbers, booleans, null, undefined, symbols not ANY)
    return { isMatch: Object.is(pattern, fact), bindings }; // Object.is handles NaN === NaN and -0 !== +0 correctly
  }
}
