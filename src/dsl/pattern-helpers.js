/**
 * @file Defines the `_` (when) helper object, which provides a rich set of
 * predicates and builders for defining rule conditions, guards, projections, and accumulators.
 * This is the core of the engine's declarative Domain Specific Language (DSL).
 * @exports _
 */

/**
 * The primary helper object for building rule and query conditions.
 * It's a collection of predicate functions and builder objects.
 * Typically used as `_` (underscore) for brevity in rule/query definitions.
 *
 * @namespace _
 * @property {object} guard - Builders for S-expression guard arrays used in `Rule(...).pre([...])`.
 * @property {object} select - Builders for S-expression projection arrays used in `Query(...).select({...})`. Alias to `_.guard`.
 * @property {function(object): object} from - Starts a fluent chain for defining accumulator conditions.
 */
export const _ = {
  // ====================================================================
  // I. CORE PREDICATES & TYPE/EXISTENCE CHECKS
  // ====================================================================

  /**
   * Creates a predicate that checks if a value's JavaScript type matches the specified type.
   * For 'array', it uses `Array.isArray()`. For 'any', it always returns true. For 'null', it checks strict null.
   * @function isType
   * @memberof _
   * @param {'string'|'number'|'boolean'|'array'|'object'|'function'|'symbol'|'bigint'|'undefined'|'null'|'any'|string} typeName - The expected JavaScript type name or a custom template name (engine resolves custom template types).
   * @returns {function(*): boolean} A predicate function that takes a value and returns true if its type matches.
   * @example _.isType('number')
   * @example _.isType('userTemplate') // For custom deftemplate types
   */
  isType: (typeName) => (factValue) => {
    if (typeName === 'any') return true;
    if (typeName === 'array') return Array.isArray(factValue);
    if (typeName === 'null') return factValue === null;
    if (typeName === 'object') return factValue !== null && typeof factValue === 'object';
    // For custom template types, the engine's matcher handles this by checking fact.type
    // This helper is primarily for primitive JS types and 'array'/'object'.
    return typeof factValue === typeName;
  },

  /**
   * Creates a predicate that checks if a value is strictly `null`.
   * @function isNull
   * @memberof _
   * @returns {function(*): boolean} A predicate function.
   * @example { user: { middleName: _.isNull() } }
   */
  isNull: () => (factValue) => factValue === null,

  /**
   * Creates a predicate that checks if a value is strictly `undefined`.
   * @function isUndefined
   * @memberof _
   * @returns {function(*): boolean} A predicate function.
   * @example { user: { optionalField: _.isUndefined() } }
   */
  isUndefined: () => (factValue) => factValue === undefined,

  /**
   * Creates a predicate that checks if a value is `null` OR `undefined`.
   * @function isNil
   * @memberof _
   * @returns {function(*): boolean} A predicate function.
   * @example { order: { trackingNumber: _.isNil() } }
   */
  isNil: () => (factValue) => factValue == null, // `== null` checks for both null and undefined

  /**
   * Creates a predicate that checks if a value is NOT `null` AND NOT `undefined`.
   * @function isDefined
   * @memberof _
   * @returns {function(*): boolean} A predicate function.
   * @example { user: { email: _.isDefined() } }
   */
  isDefined: () => (factValue) => factValue != null,

  /**
   * Creates a predicate that checks if an object has a specific property (own property).
   * @function hasProperty
   * @memberof _
   * @param {string} propName - The name of the property to check for.
   * @returns {function(object): boolean} A predicate function.
   * @example { user: _.hasProperty('address') }
   */
  hasProperty: (propName) => (factValue) =>
    typeof factValue === 'object' && factValue !== null && Object.prototype.hasOwnProperty.call(factValue, propName),

  // ====================================================================
  // II. STRING OPERATORS
  // ====================================================================
  /** @function startsWith @memberof _ @param {string} prefix @returns {function(string): boolean} @example _.startsWith('SKU-') */
  startsWith: (prefix) => (factValue) => typeof factValue === 'string' && factValue.startsWith(prefix),
  /** @function endsWith @memberof _ @param {string} suffix @returns {function(string): boolean} @example _.endsWith('.com') */
  endsWith: (suffix) => (factValue) => typeof factValue === 'string' && factValue.endsWith(suffix),
  /** @function matches @memberof _ @param {RegExp} regex @returns {function(string): boolean} @example _.matches(/@.+\..+/) */
  matches: (regex) => (factValue) => typeof factValue === 'string' && regex.test(factValue),

  // ====================================================================
  // III. NUMERIC / RANGE OPERATORS
  // ====================================================================
  /** @function gt @memberof _ @param {number} val @returns {function(number): boolean} @example _.gt(100) */
  gt: (val) => (factValue) => typeof factValue === 'number' && !isNaN(factValue) && factValue > val,
  /** @function gte @memberof _ @param {number} val @returns {function(number): boolean} @example _.gte(100) */
  gte: (val) => (factValue) => typeof factValue === 'number' && !isNaN(factValue) && factValue >= val,
  /** @function lt @memberof _ @param {number} val @returns {function(number): boolean} @example _.lt(100) */
  lt: (val) => (factValue) => typeof factValue === 'number' && !isNaN(factValue) && factValue < val,
  /** @function lte @memberof _ @param {number} val @returns {function(number): boolean} @example _.lte(100) */
  lte: (val) => (factValue) => typeof factValue === 'number' && !isNaN(factValue) && factValue <= val,
  /** @function between @memberof _ @param {number} min @param {number} max @returns {function(number): boolean} @example _.between(18, 65) */
  between: (min, max) => (factValue) => typeof factValue === 'number' && !isNaN(factValue) && factValue >= min && factValue <= max,

  // ====================================================================
  // IV. COLLECTION OPERATORS
  // ====================================================================
  /** @function contains @memberof _ @param {*} element @returns {function(Array<*>): boolean} @example _.contains('vip') */
  contains: (element) => (factValue) => Array.isArray(factValue) && factValue.includes(element),
  /** @function hasSize @memberof _ @param {number|function} sizeMatcher @returns {function(Array<*>|Set<*>|Map<*,*>|string): boolean} @example _.hasSize(3) or _.hasSize(_.gt(0)) */
  hasSize: (sizeMatcher) => (factValue) => {
    const size = factValue?.length ?? factValue?.size;
    if (typeof size !== 'number') return false;
    if (typeof sizeMatcher === 'function') return sizeMatcher(size);
    return size === sizeMatcher;
  },
  /** @function intersects @memberof _ @param {Array<*>} arr @returns {function(Array<*>): boolean} @example _.intersects(['urgent', 'critical']) */
  intersects: (arr) => (factValue) => {
    if (!Array.isArray(factValue) || !Array.isArray(arr)) return false;
    const factSet = new Set(factValue);
    return arr.some(item => factSet.has(item));
  },

  // ====================================================================
  // V. FUNCTIONAL & HIGHER-ORDER OPERATORS
  // ====================================================================
  /** @function every @memberof _ @param {function(*):boolean | *} innerPredicate @returns {function(Array<*>): boolean} @example _.every(item => item.isActive) */
  every: (innerPredicate) => (factValue) => {
    if (!Array.isArray(factValue)) return false;
    const testFn = typeof innerPredicate === 'function' ? innerPredicate : (val) => val === innerPredicate;
    return factValue.every(testFn);
  },
  /** @function some @memberof _ @param {function(*):boolean | *} innerPredicate @returns {function(Array<*>): boolean} @example _.some(item => item.isFlagged) */
  some: (innerPredicate) => (factValue) => {
    if (!Array.isArray(factValue)) return false;
    const testFn = typeof innerPredicate === 'function' ? innerPredicate : (val) => val === innerPredicate;
    return factValue.some(testFn);
  },
  /** @function transform @memberof _ @param {function(*): *} transformerFn @param {function(*):boolean | *} predicate @returns {function(*): boolean} @example _.transform(s => s.toUpperCase(), 'ADMIN') */
  transform: (transformerFn, predicate) => (factValue) => {
    const transformedValue = transformerFn(factValue);
    const testFn = typeof predicate === 'function' ? predicate : (val) => val === predicate;
    return testFn(transformedValue);
  },
  /** @function is @memberof _ @param {function(*):boolean} validatorFn @returns {function(*): boolean} @example _.is(myCustomValidator) */
  is: (validatorFn) => (factValue) => validatorFn(factValue),

  // ====================================================================
  // VI. LOGICAL COMBINATORS
  // ====================================================================
  /** @function allOf @memberof _ @param {...(function(*):boolean)} innerPredicates @returns {function(*): boolean} @example _.allOf(_.isType('string'), _.startsWith('A')) */
  allOf: (...innerPredicates) => (factValue) => {
    return innerPredicates.every(p => {
      if (typeof p !== 'function') { console.warn("Non-function passed to _.allOf"); return !!p; }
      return p(factValue);
    });
  },
  /** @function anyOf @memberof _ @param {...(function(*):boolean | *)} predicatesOrValues @returns {function(*): boolean} @example _.anyOf('admin', 'editor', _.startsWith('guest_')) */
  anyOf: (...predicatesOrValues) => (factValue) => {
    return predicatesOrValues.some(p => {
      if (typeof p === 'function') return p(factValue);
      return factValue === p;
    });
  },
  /** @function not @memberof _ @param {function(*):boolean | *} predicateOrValue @returns {function(*): boolean} @example _.not('disabled') or _.not(_.gt(10)) */
  not: (predicateOrValue) => (factValue) => {
    if (typeof predicateOrValue === 'function') return !predicateOrValue(factValue);
    return factValue !== predicateOrValue;
  },

  // ====================================================================
  // VII. NEGATION AS FAILURE (NAF)
  // ====================================================================
  /**
   * Defines a condition that passes if no facts match the provided pattern object.
   * Used as a top-level condition in `Rule(...).when(...)` or `Query(...).when(...)`.
   * @function lacks
   * @memberof _
   * @param {object} patternObject - The pattern to check for absence. Format: `{ typeName: { fieldPatterns } }`.
   * @returns {object} An internal structure representing a "lacks" condition for the engine.
   * @example Rule('NotifySupport').when(_.lacks({ type: 'support_agent', status: 'available' })).then(...)
   */
  lacks: (patternObject) => ({ _isLacksCondition: true, pattern: patternObject }),

  // ====================================================================
  // VIII. ACCUMULATOR BUILDER (`_.from`)
  // ====================================================================
  /**
   * Starts a fluent chain for defining accumulator conditions.
   * Used as a top-level condition in `Rule(...).when(...)` or `Query(...).when(...)`.
   * @function from
   * @memberof _
   * @param {object} pattern - The pattern to match facts for accumulation (e.g., `{ type: 'order', status: 'completed' }`).
   * @returns {{sum: function(string): object, count: function(): object, average: function(string): object, collect: function(string): object}}
   * An object with accumulator methods (`sum`, `count`, `average`, `collect`), each returning an object
   * with an `into(variableName)` method to complete the definition.
   * @example
   * Rule('BigSpenderAlert')
   * .when(
   * { user: { id: '?userId' } },
   * _.from({ type: 'order', userId: '?userId' }).sum('total').into('?totalSpent')
   * ) // ...
   */
  from: (pattern) => {
    const baseAccumulatorDef = { _isAccumulator: true, from: pattern };
    return {
      /** @param {string} field @returns {{into: function(string): object}} */
      sum: (field) => ({ ...baseAccumulatorDef, accumulate: 'sum', on: field, into: (varName) => ({ ...baseAccumulatorDef, accumulate: 'sum', on: field, into: varName }) }),
      /** @returns {{into: function(string): object}} */
      count: () => ({ ...baseAccumulatorDef, accumulate: 'count', into: (varName) => ({ ...baseAccumulatorDef, accumulate: 'count', into: varName }) }),
      /** @param {string} field @returns {{into: function(string): object}} */
      average: (field) => ({ ...baseAccumulatorDef, accumulate: 'average', on: field, into: (varName) => ({ ...baseAccumulatorDef, accumulate: 'average', on: field, into: varName }) }),
      /** @param {string} field @returns {{into: function(string): object}} */
      collect: (field) => ({ ...baseAccumulatorDef, accumulate: 'collect', on: field, into: (varName) => ({ ...baseAccumulatorDef, accumulate: 'collect', on: field, into: varName }) })
    };
  },

  // ====================================================================
  // IX. GUARD & SELECT EXPRESSION BUILDERS
  // ====================================================================
  /**
   * A collection of functions to declaratively build safe, S-expression guard arrays.
   * These are used in `Rule(...).pre([...])`.
   * Each function returns an array representing an S-expression.
   * @namespace _.guard
   */
  guard: {
    /** @function gt @memberof _.guard @param {*} a - Left operand (variable string, literal, or S-expression). @param {*} b - Right operand. @returns {Array<*>} `['>', a, b]` */
    gt: (a, b) => ['>', a, b],
    /** @function gte @memberof _.guard @param {*} a @param {*} b @returns {Array<*>} `['>=', a, b]` */
    gte: (a, b) => ['>=', a, b],
    /** @function lt @memberof _.guard @param {*} a @param {*} b @returns {Array<*>} `['<', a, b]` */
    lt: (a, b) => ['<', a, b],
    /** @function lte @memberof _.guard @param {*} a @param {*} b @returns {Array<*>} `['<=', a, b]` */
    lte: (a, b) => ['<=', a, b],
    /** @function eq @memberof _.guard @param {*} a @param {*} b @returns {Array<*>} `['===', a, b]` */
    eq: (a, b) => ['===', a, b],
    /** @function neq @memberof _.guard @param {*} a @param {*} b @returns {Array<*>} `['!==', a, b]` */
    neq: (a, b) => ['!==', a, b],
    /** @function add @memberof _.guard @param {...*} args - Values to add. @returns {Array<*>} `['+', ...args]` */
    add: (...args) => ['+', ...args],
    /** @function subtract @memberof _.guard @param {*} a @param {*} b @returns {Array<*>} `['-', a, b]` */
    subtract: (a, b) => ['-', a, b],
    /** @function multiply @memberof _.guard @param {...*} args - Values to multiply. @returns {Array<*>} `['*', ...args]` */
    multiply: (...args) => ['*', ...args],
    /** @function divide @memberof _.guard @param {*} a Dividend. @param {*} b Divisor. @returns {Array<*>} `['/', a, b]` */
    divide: (a, b) => ['/', a, b],
    /**
     * Creates an S-expression to safely retrieve a value at a nested path.
     * @function path
     * @memberof _.guard
     * @param {string|Array<*>} target - The variable (e.g., '?user') or S-expression for the target object/array.
     * @param {...(string|number|string)} pathSegments - Sequence of property names or array indices. Can be variables.
     * @returns {Array<*>} `['path', target, ...pathSegments]`
     * @example _.guard.path('?user', 'address', 'street')
     */
    path: (target, ...pathSegments) => ['path', target, ...pathSegments],
    /**
     * Creates an S-expression to safely retrieve a value at a nested path, returning a default if path is invalid.
     * @function pathOr
     * @memberof _.guard
     * @param {*} defaultValue - The value to return if the path is invalid or result is nil.
     * @param {string|Array<*>} target - The variable or S-expression for the target object/array.
     * @param {...(string|number|string)} pathSegments - Sequence of property names or array indices. Can be variables.
     * @returns {Array<*>} `['pathOr', defaultValue, target, ...pathSegments]`
     * @example _.guard.pathOr('N/A', '?user', 'contactInfo', 0, 'email')
     */
    pathOr: (defaultValue, target, ...pathSegments) => ['pathOr', defaultValue, target, ...pathSegments]
  },

  /**
   * A collection of functions to declaratively build S-expression arrays for query projections.
   * This is an alias to `_.guard` as they share the same S-expression building capabilities.
   * Used in `Query(...).select({...})`.
   * @namespace _.select
   * @borrows _.guard.gt as _.select.gt
   * @borrows _.guard.gte as _.select.gte
   * @borrows _.guard.lt as _.select.lt
   * @borrows _.guard.lte as _.select.lte
   * @borrows _.guard.eq as _.select.eq
   * @borrows _.guard.neq as _.select.neq
   * @borrows _.guard.add as _.select.add
   * @borrows _.guard.subtract as _.select.subtract
   * @borrows _.guard.multiply as _.select.multiply
   * @borrows _.guard.divide as _.select.divide
   * @borrows _.guard.path as _.select.path
   * @borrows _.guard.pathOr as _.select.pathOr
   */
  select: {} // Will be aliased after `_` object is fully defined.
};

// Alias _.select to _.guard as they use the same S-expression builders
_.select = _.guard;