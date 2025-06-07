// /home/justin/clarus/src/dsl/RuleBuilder.js
/**
 * @file Defines the fluent RuleBuilder API for creating rule definitions.
 * This builder allows for a step-by-step, readable construction of rules
 * with conditions, actions, and various lifecycle/AOP (Aspect-Oriented Programming) features.
 */

// It's assumed that the `_` (when) helper object, particularly `_.guard` for pre-conditions,
// would be available in the scope where rules are defined (e.g., imported by the user).

/**
 * A fluent builder for creating rule definitions.
 * Instances are typically created via the `Rule(id)` factory function.
 * This builder allows for a declarative and chainable way to specify
 * all aspects of a rule, from its matching conditions to its action and
 * AOP lifecycle hooks.
 * @export
 */
export class RuleBuilder {
  /**
   * Initializes a new RuleBuilder instance.
   * @param {string} id - The unique identifier for the rule. This ID is used by the engine
   * for tracking, dynamic retraction, and in event logs.
   * @throws {Error} If the provided ID is not a non-empty string.
   */
  constructor(id) {
    if (typeof id !== 'string' || id.trim() === '') {
      throw new Error("RuleBuilder: Rule ID must be a non-empty string.");
    }
    /**
     * The internal rule definition object being built.
     * @private
     * @type {{
     * id: string,
     * when: Array<object|{_isAccumulator:boolean, from:object, accumulate:string, on?:string, into:string}|{_isLacksCondition:boolean, pattern:object}|Array<object|Array<*>>>,
     * pre: Array<Array<*>>,
     * then?: function(object, object): (void|Promise<void>),
     * post?: Array<object|Array<*>>,
     * throws?: Object<string, function(Error, object, object): (void|Promise<void>)>,
     * log?: {before?: boolean, after?: boolean},
     * salience: number,
     * around?: function(object, object, function(): Promise<void>): Promise<void>,
     * after?: function(object, object): (void|Promise<void>)
     * }}
     */
    this.rule = { id, when: [], pre: [], salience: 0 };
  }

  /**
   * Adds condition patterns, accumulators, or "lacks" conditions to the rule's `when` clause.
   * All conditions in the `when` clause are implicitly ANDed together by the engine's matching logic.
   * A condition can also be an array `[patternObject, ...guards]` for inline guards on a pattern.
   * @param {...(object|{_isAccumulator:boolean, from:object, accumulate:string, on?:string, into:string}|{_isLacksCondition:boolean, pattern:object}|Array<object|Array<*>>)} conditions
   * - One or more conditions. These can be:
   * 1. Simple pattern objects (e.g., `{ type: 'user', status: 'active', name: '?userName' }`).
   * 2. Accumulator definitions created with `_.from(...)` (e.g., `_.from({ type: 'order' }).count().into('?orderCount')`).
   * 3. "Lacks" conditions created with `_.lacks(...)` (e.g., `_.lacks({ type: 'error_flag' })`).
   * 4. An array where the first element is a pattern object and subsequent elements are S-expression guards for that pattern.
   * @returns {RuleBuilder} The builder instance for chaining.
   * @example
   * Rule('MyRule')
   * .when(
   * { user: { id: '?userId', status: 'active' } }, // Simple pattern
   * _.from({ type: 'order', userId: '?userId' }).sum('total').into('?totalSpent'), // Accumulator
   * _.lacks({ type: 'user_hold', userId: '?userId' }), // Lacks condition
   * [{ ticket: { assignee: '?userId', priority: 'high' } }, _.guard.eq('?priority', 'high')] // Pattern with inline guard
   * )
   */
  when(...conditions) {
    // console.log(`Adding conditions to rule [${this.rule.id}]:`, conditions); // Keep for debugging if needed
    this.rule.when.push(...conditions);
    return this;
  }

  /**
   * Adds pre-conditions (guards) to the rule. These are S-expressions evaluated after
   * the `when` patterns have matched and bound variables, but before the `then` action.
   * If multiple guard S-expressions are provided as separate arguments, they are implicitly ANDed together
   * by being wrapped in an `['and', ...]` S-expression.
   * For explicit OR or more complex AND/OR combinations, pass a single S-expression
   * array using operators like `['or', guard1, guard2]`.
   * @param {...Array<*>} guards - S-expression guard arrays, typically built with `_.guard`
   * (e.g., `_.guard.gt('?age', 18)`, `_.guard.eq('?status', 'approved')`).
   * @returns {RuleBuilder} The builder instance for chaining.
   * @example
   * .pre(
   * _.guard.gt('?orderTotal', 100),    // Guard 1
   * _.guard.eq('?customerStatus', 'vip') // Guard 2 (implicitly ANDed with Guard 1)
   * )
   * // For complex OR:
   * .pre(
   * ['or',
   * _.guard.gt('?score', 750),
   * _.guard.eq('?overrideFlag', true)
   * ]
   * )
   */
  pre(...guards) {
    if (guards.length === 1 && Array.isArray(guards[0]) && typeof guards[0][0] === 'string' && (guards[0][0].toLowerCase() === 'and' || guards[0][0].toLowerCase() === 'or')) {
      // If a single, explicitly structured 'and' or 'or' S-expression is passed, use it directly.
      this.rule.pre.push(guards[0]);
    } else if (guards.length > 0) {
      // If multiple guards are passed, or a single simple guard, wrap them in an implicit 'and'.
      // The engine's #checkRule expects rule.pre to be an array of S-expressions (guards).
      // The every() loop in #checkRule handles the implicit AND for the top-level pre array.
      this.rule.pre.push(...guards);
    }
    return this;
  }

  /**
   * Defines the action (the "then" block) to be executed when the rule's conditions and pre-conditions are met.
   * This method is **required** for a rule to be valid.
   * @param {function(object, object): (void|Promise<void>)} actionFn - The action function.
   * It receives `context` (an object with methods like `assertFact`, `modifyFact`, `publish`, etc.)
   * and `bindings` (an object containing the variables bound in the `when` clause).
   * The function can be `async` if it needs to perform asynchronous operations.
   * @returns {RuleBuilder} The builder instance for chaining.
   * @throws {TypeError} If actionFn is not a function.
   * @example
   * .then(async (context, bindings) => {
   * console.log(`User ${bindings['?userName']} is active.`);
   * context.assertFact({ type: 'user_notification', userId: bindings['?userId'] });
   * })
   */
  then(actionFn) {
    if (typeof actionFn !== 'function') {
      throw new TypeError(`Rule [${this.rule.id}] .then() action must be a function.`);
    }
    this.rule.then = actionFn;
    return this;
  }

  /**
   * Sets the salience (priority) of the rule. Higher numbers indicate higher priority and fire first.
   * Defaults to `0` if not specified.
   * @param {number} priority - The salience value.
   * @returns {RuleBuilder} The builder instance for chaining.
   * @throws {TypeError} If priority is not a number.
   */
  salience(priority) {
    if (typeof priority !== 'number') {
      throw new TypeError(`Rule [${this.rule.id}] salience must be a number. Got: ${typeof priority}`);
    }
    this.rule.salience = priority;
    return this;
  }

  /**
   * Defines an "around" advice for Aspect-Oriented Programming (AOP).
   * This function wraps the core rule action (`then` block) and its associated lifecycle stages (logging, post-conditions).
   * It allows running code before and after the core action, and to control its execution.
   * @param {function(object, object, function(): Promise<void>): Promise<void>} aroundFn - The around advice function.
   * It receives `context`, `bindings`, and a `proceed` function. Call `await proceed()` to execute
   * the main rule action and its subsequent lifecycle steps (post-conditions, after-action logging).
   * Not calling `proceed` will prevent the main action from running.
   * @returns {RuleBuilder} The builder instance for chaining.
   * @throws {TypeError} If aroundFn is not a function.
   */
  around(aroundFn) {
    if (typeof aroundFn !== 'function') {
      throw new TypeError(`Rule [${this.rule.id}] .around() advice must be a function.`);
    }
    this.rule.around = aroundFn;
    return this;
  }

  /**
   * Defines an "after" (finally) advice for AOP.
   * This function executes after the main rule action and any `around` or `post` logic,
   * regardless of whether the action succeeded or threw an error (that wasn't re-thrown by `throws`).
   * Useful for cleanup tasks like releasing resources.
   * @param {function(object, object): (void|Promise<void>)} afterFn - The after advice function. Receives `context` and `bindings`.
   * @returns {RuleBuilder} The builder instance for chaining.
   * @throws {TypeError} If afterFn is not a function.
   */
  after(afterFn) {
    if (typeof afterFn !== 'function') {
      throw new TypeError(`Rule [${this.rule.id}] .after() advice must be a function.`);
    }
    this.rule.after = afterFn;
    return this;
  }

  /**
   * Defines "post-conditions" for the rule. These are query-like conditions that are checked
   * *after* the rule's `then` action has successfully completed (and after `around` advice if present,
   * but before `after` advice).
   * If any post-condition query yields no results, a warning event (`rule:postConditionFailed`) is emitted.
   * Each argument is a condition that will be checked. A condition can be a simple pattern object
   * or an array of `[patternObject, ...guards]`.
   * @param {...(object|Array<*>)} postConditions - One or more query condition objects
   * (e.g., `{ type: 'log_entry', ruleId: this.rule.id }`) or `[patternObject, ...guards]` arrays.
   * Each will be evaluated against the current fact base using the bindings from the rule's `when` clause.
   * @returns {RuleBuilder} The builder instance for chaining.
   * @example
   * .post(
   * { type: 'order_status_updated', orderId: '?oid', status: 'processed' },
   * [{ type: 'audit_log', action: 'order_processed', entityId: '?oid'}, _.guard.isDefined('?oid')]
   * )
   */
  post(...postConditions) {
    this.rule.post = postConditions.map(cond => {
      // Ensure each post-condition is wrapped appropriately for the engine's #checkRule method
      // A simple pattern {type:'x'} becomes [{type:'x'}]
      // A pattern with guards [ {type:'x'}, guard ] remains as is.
      if (Array.isArray(cond) && typeof cond[0] === 'object' && !cond[0]._isAccumulator && !cond[0]._isLacksCondition) {
        return cond; // It's already a [patternObject, ...guards] structure
      }
      return [cond]; // Wrap simple pattern object
    });
    return this;
  }

  /**
   * Defines declarative error handlers for specific error types thrown by the rule's `then` action.
   * If an error is thrown from the `then` block (or from `proceed()` if `around` is used),
   * and its constructor name matches a key in `errorHandlers`, the corresponding
   * handler function is called. If the handler does not re-throw, the error is considered handled,
   * and the `after` advice will still run. Unhandled errors will propagate.
   * @param {Object<string, function(Error, object, object): (void|Promise<void>)>} errorHandlers - An object where keys
   * are error constructor names (e.g., `'TypeError'`, `'MyCustomError'`) and values are handler functions.
   * Handlers receive the `error` instance, `context`, and `bindings`.
   * @returns {RuleBuilder} The builder instance for chaining.
   * @throws {TypeError} If errorHandlers is not an object or its values are not functions.
   */
  throws(errorHandlers) {
    if (typeof errorHandlers !== 'object' || errorHandlers === null) {
      throw new TypeError(`Rule [${this.rule.id}] .throws() argument must be an object.`);
    }
    for (const errName in errorHandlers) {
      if (typeof errorHandlers[errName] !== 'function') {
        throw new TypeError(`Rule [${this.rule.id}] .throws() handler for '${errName}' must be a function.`);
      }
    }
    this.rule.throws = errorHandlers;
    return this;
  }

  /**
   * Configures logging for the rule's execution lifecycle.
   * When enabled, the engine emits `rule:log` events with `timing: 'before'` (before the action)
   * and `timing: 'after'` (after the action, but before post-conditions).
   * @param {{before?: boolean, after?: boolean}} logConfig - Configuration object.
   * @returns {RuleBuilder} The builder instance for chaining.
   * @throws {TypeError} If logConfig is not an object.
   * @example .log({ before: true, after: true })
   */
  log(logConfig) {
    if (typeof logConfig !== 'object' || logConfig === null) {
      throw new TypeError(`Rule [${this.rule.id}] .log() argument must be an object.`);
    }
    this.rule.log = logConfig;
    return this;
  }

  /**
   * Finalizes the rule definition and returns the complete rule object.
   * This object is then ready to be added to the `LeapEngine` via `engine.addDefinition()`.
   * @returns {object} The complete rule definition object.
   * @throws {Error} If the rule's action (`then` block) has not been defined using `.then()`.
   */
  build() {
    if (typeof this.rule.then !== 'function') {
      throw new Error(`Rule [${this.rule.id}] must have a .then() action defined before building.`);
    }
    // Ensure `pre` is an array, even if empty, for consistent handling in the engine
    if (!Array.isArray(this.rule.pre)) {
      this.rule.pre = [];
    }
    // Ensure `when` is an array, even if .when() was never called.
    if (!Array.isArray(this.rule.when)) {
      this.rule.when = [];
    }
    return this.rule;
  }
}

/**
* Factory function and entry point for fluently defining a new rule.
* @param {string} id - The unique identifier for the rule.
* @returns {RuleBuilder} A new RuleBuilder instance to chain methods on.
* @export
* @example
* const myComplexRule = Rule('ComplexProcessing')
* .salience(10)
* .when(
* { type: 'input_data', value: '?val' },
* _.from({ type: 'history', key: '?val' }).count().into('?historyCount')
* )
* .pre(
* _.guard.gt('?historyCount', 0),
* _.guard.lt('?val', 100)
* )
* .around(async (ctx, b, proceed) => {
* // Perform setup, e.g., start transaction
* await proceed(); // Execute .then() and other inner advices
* // Perform teardown, e.g., commit/rollback transaction
* })
* .then(async (context, bindings) => {
* // Main action logic
* context.assertFact({ type: 'processed_data', originalValue: bindings['?val'] });
* })
* .post(
* { type: 'processed_data', originalValue: '?val' } // Check if processed_data was asserted
* )
* .after((ctx, b) => { *cleanup logic, always runs* })
* .throws({ 'MyCustomError': (e, c, b) => c.assertFact({ type: 'error_log', message: e.message }) })
  * .log({ before: true, after: true })
  * .build();
*/
export const Rule = (id) => new RuleBuilder(id);
