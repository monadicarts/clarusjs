/**
 * @file Built-in accumulator functions for rule/query conditions.
 * Accumulators perform aggregate operations (sum, count, average, collect, min, max, etc.)
 * over a set of facts that match a specific pattern.
 * @module strategies/Accumulators
 */

/**
 * Checks if a value is a valid number (not NaN).
 * @param {*} value
 * @returns {boolean}
 */
function isValidNumber(value) {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Checks if a value is a boolean.
 * @param {*} value
 * @returns {boolean}
 */
function isValidBoolean(value) {
  return typeof value === 'boolean';
}

/**
 * Checks if a value is a valid Date, or a string/number that can be parsed as a Date.
 * @param {*} value
 * @returns {boolean}
 */
function isValidDate(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return true;
  if (typeof value === 'string' && value.length > 0 && isNaN(Number(value))) {
    const d = new Date(value);
    return !isNaN(d.getTime());
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    return !isNaN(d.getTime());
  }
  return false;
}

/**
 * Converts a value to a Date if possible.
 * @param {*} value
 * @returns {Date|null}
 */
function toDate(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === 'string' && value.length > 0 && isNaN(Number(value))) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Checks if a value is a valid string for min/max (not a number, not a valid date).
 * @param {*} value
 * @returns {boolean}
 */
function isValidString(value) {
  return typeof value === 'string' && value.length > 0 && isNaN(Number(value)) && !isValidDate(value);
}

/**
 * @namespace accumulators
 * @description Built-in accumulator functions for aggregation over fact arrays.
 */
export const accumulators = {
  /**
   * Sums all numeric values for a field. Treats booleans as 1/0.
   * @param {string} field
   * @returns {function(Array<object>): number}
   */
  sum: (field) => (facts) =>
    facts.reduce((acc, fact) => {
      const value = fact[field];
      if (typeof value === 'boolean') return acc + (value ? 1 : 0);
      if (isValidNumber(value)) return acc + value;
      return acc;
    }, 0),

  /**
   * Counts the number of facts.
   * @returns {function(Array<object>): number}
   */
  count: () => (facts) => facts.length,

  /**
   * Calculates the average of all numeric values for a field. Treats booleans as 1/0.
   * @param {string} field
   * @returns {function(Array<object>): number}
   */
  average: (field) => (facts) => {
    let total = 0, count = 0;
    for (const fact of facts) {
      const value = fact[field];
      if (typeof value === 'boolean') {
        total += value ? 1 : 0;
        count++;
      } else if (isValidNumber(value)) {
        total += value;
        count++;
      }
    }
    return count === 0 ? 0 : total / count;
  },

  /**
   * Collects all values for a field.
   * @param {string} field
   * @returns {function(Array<object>): Array<*>}
   */
  collect: (field) => (facts) => facts.map(fact => fact[field]),

  /**
   * Returns the minimum numeric value for a field, or Infinity if none.
   * @param {string} field
   * @returns {function(Array<object>): number}
   */
  minNumber: (field) => (facts) => {
    let min = Infinity, found = false;
    for (const fact of facts) {
      const v = fact[field];
      if (isValidNumber(v)) {
        found = true;
        if (v < min) min = v;
      }
    }
    return found ? min : Infinity;
  },

  /**
   * Returns the maximum numeric value for a field, or -Infinity if none.
   * @param {string} field
   * @returns {function(Array<object>): number}
   */
  maxNumber: (field) => (facts) => {
    let max = -Infinity, found = false;
    for (const fact of facts) {
      const v = fact[field];
      if (isValidNumber(v)) {
        found = true;
        if (v > max) max = v;
      }
    }
    return found ? max : -Infinity;
  },

  /**
   * Returns the minimum date value for a field, or null if none.
   * @param {string} field
   * @returns {function(Array<object>): Date|null}
   */
  minDate: (field) => (facts) => {
    let min = null;
    for (const fact of facts) {
      const d = toDate(fact[field]);
      if (d) min = !min || d < min ? d : min;
    }
    return min;
  },

  /**
   * Returns the maximum date value for a field, or null if none.
   * @param {string} field
   * @returns {function(Array<object>): Date|null}
   */
  maxDate: (field) => (facts) => {
    let max = null;
    for (const fact of facts) {
      const d = toDate(fact[field]);
      if (d) max = !max || d > max ? d : max;
    }
    return max;
  },

  /**
   * Returns the minimum string value for a field, or undefined if none.
   * @param {string} field
   * @returns {function(Array<object>): string|undefined}
   */
  minString: (field) => (facts) => {
    let min;
    for (const fact of facts) {
      const v = fact[field];
      if (isValidString(v)) min = min === undefined || v < min ? v : min;
    }
    return min;
  },

  /**
   * Returns the maximum string value for a field, or undefined if none.
   * @param {string} field
   * @returns {function(Array<object>): string|undefined}
   */
  maxString: (field) => (facts) => {
    let max;
    for (const fact of facts) {
      const v = fact[field];
      if (isValidString(v)) max = max === undefined || v > max ? v : max;
    }
    return max;
  },

  /**
   * Returns the minimum boolean value for a field (false < true), or null if none.
   * @param {string} field
   * @returns {function(Array<object>): boolean|null}
   */
  minBoolean: (field) => (facts) => {
    let foundFalse = false, foundTrue = false;
    for (const fact of facts) {
      const v = fact[field];
      if (v === false) foundFalse = true;
      else if (v === true) foundTrue = true;
    }
    if (foundFalse) return false;
    if (foundTrue) return true;
    return null;
  },

  /**
   * Returns the maximum boolean value for a field (true > false), or null if none.
   * @param {string} field
   * @returns {function(Array<object>): boolean|null}
   */
  maxBoolean: (field) => (facts) => {
    let foundTrue = false, foundFalse = false;
    for (const fact of facts) {
      const v = fact[field];
      if (v === true) foundTrue = true;
      else if (v === false) foundFalse = true;
    }
    if (foundTrue) return true;
    if (foundFalse) return false;
    return null;
  },

  /**
   * Collects unique values for a field.
   * @param {string} field
   * @returns {function(Array<object>): Array<*>}
   */
  distinctCollect: (field) => (facts) => {
    const distinctValues = new Set();
    for (const fact of facts) {
      distinctValues.add(fact[field]);
    }
    return Array.from(distinctValues);
  }
};
