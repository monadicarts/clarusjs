// /home/justin/clarus/src/dsl/QueryBuilder.js
/**
 * @file Defines the fluent QueryBuilder API for creating query definitions.
 * This builder allows for a step-by-step, readable construction of queries
 * that the LeapEngine can execute to retrieve, shape, sort, and paginate data
 * from the fact base.
 */

// It's assumed that the `_` (when) helper object, particularly `_.select` for projections
// and `_.from` for accumulators, would be available in the scope where queries are defined
// (e.g., imported by the user).

/**
 * A fluent builder for creating query definitions.
 * Instances are typically created via the `Query(id)` factory function.
 * This builder allows for a declarative and chainable way to specify
 * all aspects of a query.
 * @export
 */
export class QueryBuilder {
  /**
   * Initializes a new QueryBuilder instance.
   * @param {string} id - The unique identifier for the query. This ID is used
   * when calling `engine.queryAll()`, `engine.queryOne()`, etc.
   * @throws {Error} If the provided ID is not a non-empty string.
   */
  constructor(id) {
    if (typeof id !== 'string' || id.trim() === '') {
      throw new Error("QueryBuilder: Query ID must be a non-empty string.");
    }
    /**
     * The internal query definition object being built.
     * @private
     * @type {{
     * id: string,
     * when: Array<object|{_isAccumulator:boolean}|{_isLacksCondition:boolean}>,
     * select?: object | Array<string>,
     * orderBy?: {key: string, direction: 'asc'|'desc'},
     * limit?: number,
     * offset?: number,
     * distinct?: boolean,
     * type: 'query'
     * }}
     */
    this.query = { id, when: [], type: 'query' };
  }

  /**
   * Adds condition patterns, accumulators, or "lacks" conditions to the query's `when` clause.
   * All conditions in the `when` clause are implicitly ANDed together by the engine's matching logic.
   * The syntax for conditions is identical to that used in `Rule(...).when(...)`.
   * @param {...(object|{_isAccumulator:boolean, from:object, accumulate:string, on?:string, into:string}|{_isLacksCondition:boolean, pattern:object})} conditions
   * - One or more conditions.
   * @returns {QueryBuilder} The builder instance for chaining.
   * @example
   * Query('FindActiveUsersWithOrders')
   * .when(
   * { user: { id: '?userId', status: 'active' } },
   * _.from({ type: 'order', userId: '?userId' }).count().into('?orderCount')
   * )
   */
  when(...conditions) {
    this.query.when.push(...conditions);
    return this;
  }

  /**
   * Defines the projection for the query, shaping the structure of the result objects.
   * If not called, the query will return the raw binding objects from the `when` clause.
   * @param {object | Array<string>} projection - An object where keys define the output field names,
   * or an array of strings representing variable names or dot-notation paths to project.
   * Values in object projection can be:
   * 1. Variable strings from the `when` clause (e.g., `'?userName'`).
   * 2. Literal values (e.g., `true`, `'Constant String'`).
   * 3. S-expression arrays built with `_.select` (alias for `_.guard`) for transformations
   * (e.g., `_.select.add('Order Total: $', '?total')`).
   * 4. Nested objects for creating structured output.
   * If an array of strings is provided (e.g., `['?orderFact']` or `['user.name', 'user.email']`),
   * the engine will attempt to resolve these directly from bindings.
   * @returns {QueryBuilder} The builder instance for chaining.
   * @throws {TypeError} If projection is not an object or an array of strings.
   * @example
   * .select({
   * customerName: '?name',
   * orderValue: '?total',
   * summary: _.select.add('User ', '?name', ' has order value $', '?total')
   * })
   * // OR
   * .select(['?order']) // Selects the entire fact bound to ?order
   * // OR
   * .select(['user.name', 'user.email']) // Selects specific fields
   */
  select(projection) {
    if (typeof projection !== 'object' || projection === null) {
      if (!Array.isArray(projection) || !projection.every(item => typeof item === 'string')) {
        throw new TypeError(`Query [${this.query.id}] .select() argument must be an object or an array of strings.`);
      }
    }
    this.query.select = projection;
    return this;
  }

  /**
   * Specifies that the query should return only unique (distinct) rows
   * based on the selected and projected fields.
   * This is applied *after* projection but *before* ordering, offsetting, and limiting.
   * @returns {QueryBuilder} The builder instance for chaining.
   */
  distinct() {
    this.query.distinct = true;
    return this;
  }

  /**
   * Defines the sorting order for the query results.
   * Applied after projection and distinctness.
   * @param {string} key - The key in the projected (and potentially distinct) result object to sort by.
   * Can be a dot-separated path for nested properties (e.g., `'user.address.zipCode'`).
   * @param {'asc'|'desc'} [direction='asc'] - The sort direction ('asc' for ascending, 'desc' for descending).
   * @returns {QueryBuilder} The builder instance for chaining.
   * @throws {TypeError} If key is not a string or direction is invalid.
   * @example
   * .orderBy('customerName', 'asc')
   * .orderBy('orderValue', 'desc')
   */
  orderBy(key, direction = 'asc') {
    if (typeof key !== 'string' || key.trim() === '') {
      throw new TypeError(`Query [${this.query.id}] .orderBy() key must be a non-empty string.`);
    }
    if (direction !== 'asc' && direction !== 'desc') {
      throw new TypeError(`Query [${this.query.id}] .orderBy() direction must be 'asc' or 'desc'.`);
    }
    this.query.orderBy = { key, direction };
    return this;
  }

  /**
   * Skips a specified number of records from the beginning of the result set.
   * Typically used with `.limit()` for pagination. Applied after projection, distinctness, and sorting.
   * @param {number} count - The number of records to skip. Must be a non-negative integer.
   * @returns {QueryBuilder} The builder instance for chaining.
   * @throws {TypeError} If count is not a non-negative number.
   * @example
   * .offset(10) // Skip the first 10 results
   */
  offset(count) {
    if (typeof count !== 'number' || count < 0 || !Number.isInteger(count)) {
      throw new TypeError(`Query [${this.query.id}] .offset() count must be a non-negative integer.`);
    }
    this.query.offset = count;
    return this;
  }

  /**
   * Limits the number of results returned by the query.
   * Applied *after* projection, distinctness, sorting, and offset.
   * @param {number} count - The maximum number of results to return. Must be a non-negative integer.
   * @returns {QueryBuilder} The builder instance for chaining.
   * @throws {TypeError} If count is not a non-negative number.
   * @example
   * .limit(10)
   */
  limit(count) {
    if (typeof count !== 'number' || count < 0 || !Number.isInteger(count)) {
      throw new TypeError(`Query [${this.query.id}] .limit() count must be a non-negative integer.`);
    }
    this.query.limit = count;
    return this;
  }

  /**
   * Finalizes the query definition and returns the complete query object.
   * This object is then ready to be added to the `LeapEngine` via `engine.addDefinition()`.
   * @returns {object} The complete query definition object.
   * This object will have `id`, `when`, `type: 'query'`, and optionally `select`, `distinct`, `orderBy`, `offset`, `limit`.
   * @throws {Error} If the query ID is missing (though typically caught by constructor).
   */
  build() {
    // ID presence is checked in constructor.
    // Ensure 'when' is an array.
    if (!Array.isArray(this.query.when)) {
      console.warn(`Query "${this.query.id}" is being built without a valid 'when' array. Defaulting to empty.`);
      this.query.when = [];
    }
    return this.query;
  }
}

/**
* Factory function and entry point for fluently defining a new query.
* @param {string} id - The unique identifier for the query.
* @returns {QueryBuilder} A new QueryBuilder instance to chain methods on.
* @export
* @example
* const myQuery = Query('FindRecentHighValueOrders')
* .when({ order: { status: 'recent', total: _.gt(500), orderId: '?oid' } })
* .select({ orderId: '?oid', amount: '?total' })
* .distinct()
* .orderBy('amount', 'desc')
* .offset(0)
* .limit(5)
* .build();
*
* engine.addDefinition(myQuery);
* const results = await engine.queryAll('FindRecentHighValueOrders');
*/
export const Query = (id) => new QueryBuilder(id);
