// engine/LeapEngine.js
/**
 * @file Defines the LeapEngine class, the core of the Clarus.js rule engine.
 * It orchestrates rule evaluation, fact management, event handling,
 * schema validation, and the AOP (Aspect-Oriented Programming) lifecycle for rules.
 */

// These would be actual imports in a modular project.
// For this self-contained example, they are assumed to be available globally or defined elsewhere
// when this class is instantiated (e.g., SimpleEventEmitter, FactStorage, Agenda, AdvancedMatcher,
// SalienceConflictResolver, accumulators, getTemplate from dsl/templates.js).
import { SimpleEventEmitter } from '../utils/SimpleEventEmitter.js';

/**
 * The LeapEngine is the central class that manages and executes rules.
 * It uses a LEAPS-inspired algorithm for efficient processing, especially
 * with dynamic data, and supports a rich set of features including
 * schema validation, accumulators, truth maintenance, AOP, and an event system.
 * @export
 * @class LeapEngine
 */
export class LeapEngine {
  /** @private @type {FactStorage} */
  #factStorage;
  /** @private @type {Agenda} */
  #agenda;
  /**
   * Stores rule and query definitions, keyed by their ID.
   * @private
   * @type {Map<string, object>}
   */
  #definitions = new Map();
  /** @private @type {AdvancedMatcher} */
  #matcher;
  /** @private @type {SalienceConflictResolver} */
  #resolver;
  /**
   * Tracks active rule activations for the Truth Maintenance System.
   * Key: activationId (number), Value: { ruleId: string, consumed: Set<number>, produced: Set<number> }
   * @private
   * @type {Map<number, {ruleId: string, consumed: Set<number>, produced: Set<number>}>}
   */
  #activations = new Map();
  /** @private @type {number} */
  #activationCounter = 0;
  /** @private @type {SimpleEventEmitter} */
  #eventEmitter;

  /**
   * Creates a new LeapEngine instance.
   * @param {object} dependencies - Core components required by the engine.
   * @param {FactStorage} dependencies.factStorage - An instance of FactStorage.
   * @param {Agenda} dependencies.agenda - An instance of Agenda.
   * @param {AdvancedMatcher} dependencies.matcher - An instance of AdvancedMatcher.
   * @param {SalienceConflictResolver} dependencies.resolver - An instance of a conflict resolver (e.g., SalienceConflictResolver).
   * @throws {Error} If any required dependencies are missing.
   */
  constructor({ factStorage, agenda, matcher, resolver }) {
    if (!factStorage || !agenda || !matcher || !resolver) {
      throw new Error("LeapEngine constructor: All dependencies (factStorage, agenda, matcher, resolver) are required.");
    }
    this.#factStorage = factStorage;
    this.#agenda = agenda;
    this.#matcher = matcher;
    this.#resolver = resolver;
    // Assumes SimpleEventEmitter is available (e.g., imported or global for this example)
    this.#eventEmitter = new SimpleEventEmitter();
  }

  /**
   * Registers an event listener for engine lifecycle events.
   * @param {string} eventName - The name of the event to listen for (see Engine Events documentation for full list).
   * @param {function(object): void} listener - The callback function to execute when the event is emitted.
   * @example
   * engine.on('fact:asserted', (data) => console.log('Fact asserted:', data.fact));
   */
  on(eventName, listener) { this.#eventEmitter.on(eventName, listener); }

  /**
   * @private Emits an engine event with a timestamp.
   * @param {string} eventName - The name of the event.
   * @param {object} data - The event data.
  */
  #emit(eventName, data) { this.#eventEmitter.emit(eventName, { ...data, timestamp: Date.now() }); }

  /**
   * Adds a rule or query definition to the engine.
   * Definitions are typically created using the `Rule().build()` or `Query().build()` fluent APIs.
   * @param {object} definition - The rule or query definition object. Must have an `id` property (string).
   */
  addDefinition(definition) {
    if (!definition || typeof definition.id !== 'string' || definition.id.trim() === '') {
      this.#emit('engine:error', { error: new Error("Definition must be an object with a non-empty string 'id'.") });
      return;
    }
    this.#definitions.set(definition.id, definition);
    this.#emit('engine:definitionAdded', { definitionId: definition.id, type: definition.type || 'rule' });
  }

  /**
   * Updates an existing fact by applying new values using an updater function.
   * The updater function receives the current state of the fact (without its `_id`)
   * and should return an object containing only the properties to be changed.
   * This operation correctly triggers the Truth Maintenance System by performing
   * an internal retract and assert.
   * @param {number} factId - The internal ID of the fact to update.
   * @param {function(object): object} updateFn - A function that takes the current fact object
   * (without its `_id` or metadata) and returns an object with the properties to update.
   * @example
   * engine.updateFact(userFact._id, (currentUser) => ({
   * visits: (currentUser.visits || 0) + 1,
   * lastSeen: new Date().toISOString()
   * }));
   */
  updateFact(factId, updateFn) {
    const originalEntry = this.#factStorage.getFactEntry(factId);
    if (!originalEntry) {
      this.#emit('engine:error', { error: new Error(`Cannot update fact: ID ${factId} not found.`), factId });
      return;
    }
    const updates = updateFn(originalEntry.fact);
    if (updates && typeof updates === 'object' && !Array.isArray(updates)) {
      this.modifyFact(factId, updates);
    } else {
      this.#emit('engine:error', { error: new Error(`Update function for fact ID ${factId} did not return a plain object with updates.`), factId });
    }
  }

  /**
   * Modifies an existing fact by merging new property values.
   * This is implemented as a retract of the old fact state and an assert of the new fact state
   * to ensure the Truth Maintenance System and rule re-evaluation occur correctly.
   * The original fact `type` is preserved. The `_id` will be new after re-assertion,
   * reflecting its new state in the engine's history.
   * @param {number} factId - The internal ID of the fact to modify.
   * @param {object} updates - An object containing the properties and new values to update.
   */
  modifyFact(factId, updates) {
    const originalEntry = this.#factStorage.getFactEntry(factId);
    if (!originalEntry) {
      this.#emit('engine:error', { error: new Error(`Cannot modify fact: ID ${factId} not found.`), factId });
      return;
    }
    // Create new fact data, preserving original type. _id will be reassigned by assert.
    const newFactData = { ...originalEntry.fact, ...updates };
    const originalType = originalEntry.fact.type; // Ensure type is preserved
    delete newFactData._id;

    this.retractFact(factId); // Retracts the old state, queues for TMS
    this.assertFact({ ...newFactData, type: originalType }); // Asserts the new state, queues for processing
  }

  /**
   * Asserts a fact into the engine's working memory.
   * If a `deftemplate` exists for the fact's `type`, the fact will be validated
   * against the template's schema (checking types, required fields, applying defaults, and running custom validators).
   * Invalid facts (failing schema validation) will not be asserted, and an 'engine:schemaError' event will be emitted.
   * @param {object} factData - The fact data to assert. Must include a `type` property (string).
   * @returns {object | null} The asserted fact object (including its engine-assigned `_id`) or `null` if assertion failed (e.g., due to schema validation or missing type).
   * @example
   * const userFact = engine.assertFact({ type: 'user', name: 'Alice', age: 30 });
   * if (userFact) { console.log('User Alice asserted with ID:', userFact._id); }
   */
  assertFact(factData) {
    let factToAssert = { ...factData }; // Clone to avoid mutating original if defaults are applied
    const templateName = factToAssert.type;

    if (typeof templateName !== 'string' || templateName.trim() === '') {
      this.#emit('engine:error', { error: new Error("Fact assertion error: 'type' property must be a non-empty string."), factData });
      return null;
    }
    // Assumes getTemplate is globally available or imported
    const template = typeof getTemplate === 'function' ? getTemplate(templateName) : null;

    // Helper function for recursive validation
    const validateObjectAgainstSchema = (obj, objSchema, objTypeForErrorMsg) => {
      for (const fieldName in objSchema) {
        const fieldDef = objSchema[fieldName];
        // This is a simplified placeholder. A full recursive validation
        // would re-apply all checks (required, type, default, custom validate)
        // for the fields of the nested object against fieldDef.
        // For now, we'll focus on the type check if the nested field is another template.
        if (typeof getTemplate === 'function' && getTemplate(fieldDef.type) && obj[fieldName]) {
          if (typeof obj[fieldName] !== 'object' || obj[fieldName].type !== fieldDef.type) {
            throw new Error(`Schema Error: Field '${fieldName}' for type '${objTypeForErrorMsg}' expected nested type '${fieldDef.type}' but got incompatible object.`);
          }
          // Potentially recurse here: validateObjectAgainstSchema(obj[fieldName], getTemplate(fieldDef.type).schema, fieldDef.type);
        }
      }
    };

    if (template) {
      const { schema } = template;
      for (const fieldName in schema) {
        const fieldSchema = schema[fieldName];
        let value = factToAssert[fieldName];
        const isFieldPresent = Object.prototype.hasOwnProperty.call(factToAssert, fieldName);

        // 1. Apply Default Value
        if (!isFieldPresent && fieldSchema.default !== undefined) {
          value = typeof fieldSchema.default === 'function'
            ? fieldSchema.default()
            : fieldSchema.default;
          factToAssert[fieldName] = value;
        }

        value = factToAssert[fieldName]; // Re-read value in case default was applied

        // 2. Check Required (only if field is still missing/nil after defaults)
        if (fieldSchema.required && (value === undefined || value === null)) {
          const errorMsg = `Schema Validation Error: Field '${fieldName}' is required for type '${templateName}' but is missing or null.`;
          this.#emit('engine:schemaError', { error: new Error(errorMsg), factData });
          return null;
        }

        // If field is not required and not present (even after defaults), skip further checks for it
        if (!fieldSchema.required && !Object.prototype.hasOwnProperty.call(factToAssert, fieldName)) {
          continue;
        }

        // 3. Check Type (if field is present)
        let typeMatches = true;
        const expectedType = fieldSchema.type;
        const actualType = Array.isArray(value) ? 'array' : (value === null ? 'null' : typeof value);

        switch (expectedType) {
          case 'string': typeMatches = actualType === 'string'; break;
          case 'number': typeMatches = actualType === 'number' && !isNaN(value); break;
          case 'boolean': typeMatches = actualType === 'boolean'; break;
          case 'array': typeMatches = actualType === 'array'; break;
          case 'object': typeMatches = actualType === 'object' && value !== null; break;
          case 'any': typeMatches = true; break;
          default:
            if (typeof getTemplate === 'function' && getTemplate(expectedType)) { // Check if it's a known template type
              if (actualType === 'object' && value !== null && value.type === expectedType) {
                typeMatches = true;
                // Attempt to validate the nested structure if its schema is known
                // This is a basic check; a full recursive validation is more complex.
                // validateObjectAgainstSchema(value, getTemplate(expectedType).schema, expectedType);
              } else {
                typeMatches = false;
              }
            } else {
              this.#emit('engine:schemaError', { error: new Error(`Unknown type '${expectedType}' in schema for '${templateName}.${fieldName}'.`), factData });
              return null;
            }
            break;
        }
        if (!typeMatches) {
          const errorMsg = `Schema Error: Field '${fieldName}' for type '${templateName}' expected type '${expectedType}' but got '${actualType}'. Value: ${JSON.stringify(value)}`;
          this.#emit('engine:schemaError', { error: new Error(errorMsg), factData });
          return null;
        }

        // 4. Custom Validator Predicate (if field is present)
        if (fieldSchema.validate && !fieldSchema.validate(value)) {
          const errorMsg = `Schema Error: Field '${fieldName}' for type '${templateName}' with value '${JSON.stringify(value)}' failed custom validation.`;
          this.#emit('engine:schemaError', { error: new Error(errorMsg), factData });
          return null;
        }
      }
    }

    const newFactEntry = this.#factStorage.assert(factToAssert);
    if (newFactEntry) {
      this.#emit('fact:asserted', { fact: newFactEntry.fact, by: 'direct' });
      this.#agenda.push({ type: 'assert', fact: newFactEntry.fact });
      return newFactEntry.fact;
    }
    return null;
  }

  /**
   * Retracts a fact from the engine's working memory by its internal ID.
   * This operation will trigger the Truth Maintenance System for any logically dependent facts.
   * @param {number} factId - The internal `_id` of the fact to retract.
   */
  retractFact(factId) {
    const retractedEntry = this.#factStorage.retract(factId);
    if (retractedEntry) {
      this.#emit('fact:retracted', { fact: retractedEntry.fact, by: 'direct', factId });
      this.#agenda.push({ type: 'retract', fact: retractedEntry.fact });
    }
  }

  /**
   * Retracts all facts matching a given pattern object.
   * @param {object} patternObject - A pattern object to match facts for retraction,
   * in the format `{ typeName: { fieldPattern1: value1, ... } }`.
   * @example engine.retractWhere({ user: { status: 'inactive' } });
   */
  retractWhere(patternObject) {
    if (typeof patternObject !== 'object' || patternObject === null) {
      this.#emit('engine:error', { error: new Error("retractWhere pattern must be an object.") });
      return;
    }
    const factType = Object.keys(patternObject)[0];
    if (!factType) {
      this.#emit('engine:error', { error: new Error("retractWhere patternObject must have a type key.") });
      return;
    }
    const pattern = patternObject[factType];
    if (typeof pattern !== 'object' || pattern === null) {
      this.#emit('engine:error', { error: new Error("retractWhere pattern for type must be an object.") });
      return;
    }

    const factsToRetract = [];
    for (const fact of this.#factStorage.getFactsByType(factType)) {
      if (this.#matcher.match(pattern, fact, {}).isMatch) {
        factsToRetract.push(fact._id);
      }
    }
    if (factsToRetract.length > 0) {
      // console.log(`\nRETRACTWHERE: Found ${factsToRetract.length} facts matching pattern for type [${factType}].`); // Optional
    }
    factsToRetract.forEach(id => this.retractFact(id));
  }

  /**
   * Executes a defined query and returns all projected results,
   * applying any specified ordering and limits.
   * @async
   * @param {string} queryId - The ID of the query definition to execute.
   * @param {object} [initialBindings={}] - Optional initial bindings to apply to the query's conditions.
   * @returns {Promise<Array<object>>} A promise that resolves to an array of projected result objects.
   * Returns an empty array if the query is not found or yields no results.
   */
  async queryAll(queryId, initialBindings = {}) {
    const query = this.#definitions.get(queryId);
    if (!query || query.type !== 'query') {
      this.#emit('engine:error', { error: new Error(`Query '${queryId}' not found or not a query definition.`) });
      return [];
    }
    this.#emit('engine:queryStarted', { queryId, initialBindings });

    const matchIterator = this.#checkRule(query, query.conditions, initialBindings);
    let allResults = [...matchIterator].map(m => m.bindings);

    let projectedResults = query.select
      ? allResults.map(b => this.#project(query.select, b, queryId))
      : allResults;

    if (query.orderBy) {
      const { key, direction = 'asc' } = query.orderBy;
      projectedResults.sort((a, b) => {
        const valA = this.#resolvePath(a, key.split('.'));
        const valB = this.#resolvePath(b, key.split('.'));
        if (valA === undefined && valB !== undefined) return direction === 'asc' ? 1 : -1; // undefined sorts last in asc
        if (valA !== undefined && valB === undefined) return direction === 'asc' ? -1 : 1; // undefined sorts last in asc
        if (valA === valB) return 0;
        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    if (query.offset !== undefined && typeof query.offset === 'number' && query.offset > 0) {
      projectedResults = projectedResults.slice(query.offset);
    }

    if (query.limit !== undefined && typeof query.limit === 'number' && query.limit >= 0) {
      projectedResults = projectedResults.slice(0, query.limit);
    }
    this.#emit('engine:queryCompleted', { queryId, resultCount: projectedResults.length });
    return projectedResults;
  }

  /**
   * Executes a query and returns the first projected result, or `null` if no matches are found.
   * @async
   * @param {string} queryId - The ID of the query definition.
   * @param {object} [initialBindings={}] - Optional initial bindings.
   * @returns {Promise<object|null>} A promise resolving to the first result or null.
   */
  async queryOne(queryId, initialBindings = {}) {
    this.#emit('engine:queryOneStarted', { queryId, initialBindings });
    const results = await this.queryAll(queryId, initialBindings);
    const result = results.length > 0 ? results[0] : null;
    this.#emit('engine:queryOneCompleted', { queryId, result });
    return result;
  }

  /**
   * Executes a query and returns `true` if any facts match its conditions, `false` otherwise.
   * This is more efficient than `queryAll().length > 0` if you only need to check for existence.
   * @async
   * @param {string} queryId - The ID of the query definition.
   * @param {object} [initialBindings={}] - Optional initial bindings.
   * @returns {Promise<boolean>} A promise resolving to true if any matches exist, false otherwise.
   */
  async queryExists(queryId, initialBindings = {}) {
    this.#emit('engine:queryExistsStarted', { queryId, initialBindings });
    const query = this.#definitions.get(queryId);
    if (!query || query.type !== 'query') {
      this.#emit('engine:error', { error: new Error(`Query '${queryId}' not found for queryExists.`) });
      return false;
    }
    const matchIterator = this.#checkRule(query, query.conditions, initialBindings);
    const firstMatch = matchIterator.next();
    const exists = !firstMatch.done;
    this.#emit('engine:queryExistsCompleted', { queryId, exists });
    return exists;
  }

  /**
   * Runs the engine until the agenda is empty. This is a "fire-and-forget" method
   * if you don't need to process each activation individually.
   * Events will still be emitted for observability.
   * @async
   * @returns {Promise<void>} A promise that resolves when the engine has completed its run.
   */
  async fireAll() {
    this.#emit('engine:fireAllStarted', { initialAgendaSize: this.#agenda.length });
    for await (const _activation of this.run()) { /* Consumes the iterator */ }
    this.#emit('engine:fireAllCompleted');
  }

  /**
   * Runs the engine until the agenda is empty and collects all rule activations
   * (the combination of a fired rule and its bindings).
   * @async
   * @returns {Promise<Array<{rule: object, bindings: object}>>} A promise resolving to an array of activation objects.
   */
  async collectActivations() {
    this.#emit('engine:collectActivationsStarted', { initialAgendaSize: this.#agenda.length });
    const activations = [];
    for await (const activation of this.run()) {
      activations.push(activation);
    }
    this.#emit('engine:collectActivationsCompleted', { count: activations.length });
    return activations;
  }

  /**
   * The main execution cycle of the engine. This is an async generator that yields
   * each rule activation as it occurs, allowing for fine-grained control over the
   * execution flow and an opportunity to interleave application logic.
   * Use with `for await (const activation of engine)` or `engine.run().next()`.
   * @async
   * @generator
   * @yields {{rule: object, bindings: object}} An object containing the rule that fired and the bindings
   * that satisfied its conditions.
   */
  async *run() {
    this.#emit('engine:beforeCycle', { agendaSize: this.#agenda.length });
    while (this.#agenda.hasTasks) {
      const task = this.#agenda.shift();
      this.#emit('agenda:taskProcessed', { task });

      if (task.type === 'retract') {
        this.#truthMaintenance(task.fact._id);
        continue;
      }

      const matchIterator = this.#findMatches(task);
      const activation = this.#resolver.resolve(matchIterator);

      if (activation) {
        const { rule, bindings, consumedFactIds } = activation;
        this.#emit('rule:activationFound', { ruleId: rule.id, bindings });

        let preConditionsPassed = true;
        if (rule.pre && rule.pre.length > 0) {
          this.#emit('rule:beforePreConditions', { ruleId: rule.id, bindings });
          preConditionsPassed = rule.pre.every(guard => {
            try { return this.#executeGuard(guard, bindings, rule.id); }
            catch (e) { /* Error already emitted by #executeGuard */ return false; }
          });
          if (!preConditionsPassed) { this.#emit('rule:preConditionsFailed', { ruleId: rule.id, bindings }); continue; }
          this.#emit('rule:afterPreConditions', { ruleId: rule.id, bindings, result: true });
        }

        const activationId = ++this.#activationCounter;
        const producedFactIds = new Set();

        const context = {
          assertFact: (factData, opts = {}) => {
            const metadata = opts.logical ? { logical: true, producedBy: activationId } : {};
            const assertedFact = this.assertFact({ ...factData }, metadata);
            if (assertedFact) {
              const finalEntry = this.#factStorage.getFactEntry(assertedFact._id);
              if (finalEntry && opts.logical) {
                finalEntry.metadata.logical = true;
                finalEntry.metadata.producedBy = activationId;
              }
              producedFactIds.add(assertedFact._id);
              this.#emit('fact:assertedByRule', { fact: assertedFact, ruleId: rule.id, logical: !!opts.logical });
              // Emit fact-produced event for TMS tests and general observation of rule-based fact production
              this.#emit('fact-produced', { fact: assertedFact, rule: rule });
              return assertedFact;
            }
            return null;
          },
          updateFact: (fId, uFn) => this.updateFact(fId, uFn),
          modifyFact: (fId, u) => this.modifyFact(fId, u),
          addRule: (rDef) => this.addDefinition(rDef.build ? rDef.build() : rDef),
          retractRule: (rId) => { this.#definitions.delete(rId); this.#emit('engine:definitionRetracted', { definitionId: rId }); },
          retractWhere: (p) => this.retractWhere(p),
          publish: (topicName, payload) => {
            const eventFact = { type: '_topic_event', topic: topicName, payload: payload, timestamp: Date.now() };
            this.assertFact(eventFact);
          }
        };
        this.#activations.set(activationId, { ruleId: rule.id, consumed: consumedFactIds, produced: producedFactIds });

        const proceed = async () => {
          if (rule.log?.before) this.#emit('rule:log', { ruleId: rule.id, timing: 'before', bindings });
          this.#emit('rule:beforeAction', { ruleId: rule.id, bindings });
          try {
            await rule.then(context, bindings);
            this.#emit('rule:actionSuccess', { ruleId: rule.id, bindings });
          } catch (e) {
            this.#emit('rule:actionError', { ruleId: rule.id, bindings, error: e });
            const errorConstructorName = e?.constructor?.name || 'Error';
            if (rule.throws?.[errorConstructorName]) {
              try {
                await rule.throws[errorConstructorName](e, context, bindings);
              } catch (handlerError) {
                this.#emit('engine:error', { error: new Error(`Error in 'throws' handler for ${errorConstructorName} in rule ${rule.id}: ${handlerError.message}`), ruleId: rule.id });
              }
            } else { throw e; }
          }
          if (rule.log?.after) this.#emit('rule:log', { ruleId: rule.id, timing: 'after', bindings });

          if (rule.post && rule.post.length > 0) {
            this.#emit('rule:beforePostConditions', { ruleId: rule.id, bindings });
            rule.post.forEach(queryCond => {
              const queryDefinition = { conditions: Array.isArray(queryCond) && typeof queryCond[0] === 'object' ? [queryCond] : [queryCond] };
              const postResults = [...this.#checkRule(queryDefinition, queryDefinition.conditions, bindings)];
              if (postResults.length === 0) {
                this.#emit('rule:postConditionFailed', { ruleId: rule.id, bindings, condition: queryCond });
              }
            });
            this.#emit('rule:afterPostConditions', { ruleId: rule.id, bindings });
          }
        };

        try {
          if (rule.around) {
            this.#emit('rule:beforeAround', { ruleId: rule.id, bindings });
            await rule.around(context, bindings, proceed);
            this.#emit('rule:afterAround', { ruleId: rule.id, bindings });
          } else {
            await proceed();
          }
        } catch (e) {
          this.#emit('engine:error', { error: e, ruleId: rule.id, phase: 'around_or_action_unhandled' });
        } finally {
          if (rule.after) {
            this.#emit('rule:beforeAfter', { ruleId: rule.id, bindings });
            try {
              await rule.after(context, bindings);
            } catch (e) {
              this.#emit('engine:error', { error: e, ruleId: rule.id, phase: 'after' });
            }
            this.#emit('rule:afterAfter', { ruleId: rule.id, bindings });
          }
        }
        this.#emit('rule:activationYielded', { ruleId: rule.id, bindings });
        yield { rule, bindings };
      }
    }
    this.#emit('engine:afterCycle', { reason: 'agenda_empty' });
  }

  /** @private Handles the Truth Maintenance System logic upon fact retraction. */
  #truthMaintenance(retractedFactId) {
    const invalidActivations = new Set();
    for (const [id, activation] of this.#activations) {
      if (activation.consumed.has(retractedFactId)) {
        invalidActivations.add(id);
      }
    }

    if (invalidActivations.size > 0) {
      this.#emit('tms:processingStarted', { retractedFactId, potentialInvalidations: invalidActivations.size });
    }

    for (const activationId of invalidActivations) {
      const activation = this.#activations.get(activationId);
      if (!activation) continue;

      this.#emit('tms:activationInvalidated', { ruleId: activation.ruleId, activationId });
      for (const factIdToRetract of activation.produced) {
        const entry = this.#factStorage.getFactEntry(factIdToRetract);
        if (entry && entry.metadata.logical && entry.metadata.producedBy === activationId) {
          this.#emit('tms:factRetracted', { fact: entry.fact, ruleId: activation.ruleId, originFactId: retractedFactId });
          this.retractFact(factIdToRetract);
        }
      }
      this.#activations.delete(activationId);
    }
  }

  /** @private Helper to resolve potentially nested property paths for sorting or projections. */
  #resolvePath(object, pathArray) {
    return pathArray.reduce((obj, key) => (obj && obj[key] !== undefined) ? obj[key] : undefined, object);
  }

  /** @private Helper to resolve values in guards/projections (handles variables, literals, and S-expressions). */
  #resolveGuardValue(value, bindings) {
    if (typeof value === 'string' && value.startsWith('?')) {
      const boundValue = bindings[value];
      if (boundValue === undefined && !Object.prototype.hasOwnProperty.call(bindings, value)) {
        throw new Error(`Guard Error: Variable ${value} is not bound.`);
      }
      return boundValue;
    }
    if (Array.isArray(value)) {
      return this.#executeGuard(value, bindings, null);
    }
    return value;
  }

  /**
   * @private Executes an S-expression guard array using a dispatch map for operators.
   * @param {Array<*>} guard - The S-expression array.
   * @param {object} bindings - Current variable bindings.
   * @param {string|null} ruleIdForContext - The ID of the rule whose guard is being executed, for error reporting.
   * @returns {*} The result of the guard expression.
   * @throws {Error} If an unknown operator is encountered or for division by zero or type errors.
   */
  #executeGuard(guard, bindings, ruleIdForContext) {
    if (!Array.isArray(guard) || guard.length === 0) {
      const errorMsg = `Guard Error: Guard expression must be a non-empty array in rule [${ruleIdForContext || 'unknown'}].`;
      this.#emit('engine:guardError', { ruleId: ruleIdForContext, guard, error: new TypeError(errorMsg), bindings });
      throw new TypeError(errorMsg);
    }
    const [op, ...args] = guard;

    if (op === 'path' || op === 'pathOr') {
      const defaultValue = (op === 'pathOr') ? args[0] : undefined;
      const targetExpression = (op === 'pathOr') ? args[1] : args[0];
      const pathSegments = (op === 'pathOr') ? args.slice(2) : args.slice(1);

      let current = this.#resolveGuardValue(targetExpression, bindings);

      for (const segment of pathSegments) {
        const resolvedSegment = this.#resolveGuardValue(segment, bindings);
        if (current == null || (typeof current !== 'object' && !Array.isArray(current))) {
          return defaultValue;
        }
        if (Array.isArray(current) && typeof resolvedSegment === 'number') {
          current = current[resolvedSegment];
        } else if (typeof current === 'object' && current !== null && Object.prototype.hasOwnProperty.call(current, String(resolvedSegment))) {
          current = current[String(resolvedSegment)];
        } else {
          return defaultValue;
        }
        if (current === undefined) {
          return op === 'path' ? undefined : defaultValue;
        }
      }
      return current === undefined && op === 'pathOr' ? defaultValue : current;
    }

    const resolvedArgs = args.map(arg => this.#resolveGuardValue(arg, bindings));

    const expectNumericOperands = (opName, operands, numExpected) => {
      if (operands.length !== numExpected) {
        const errorMsg = `Operator '${opName}' in rule [${ruleIdForContext || 'unknown'}] expects ${numExpected} numeric operands, but got ${operands.length}.`;
        this.#emit('engine:guardError', { ruleId: ruleIdForContext, guard, error: new TypeError(errorMsg), bindings });
        throw new TypeError(errorMsg);
      }
      for (let i = 0; i < operands.length; i++) {
        const operand = operands[i];
        if (typeof operand !== 'number' && typeof operand !== 'boolean') {
          const errorMsg = `Operator '${opName}' in rule [${ruleIdForContext || 'unknown'}] expects numeric operands, but got type '${typeof operand}' (value: ${operand}) at argument ${i + 1}.`;
          this.#emit('engine:guardError', { ruleId: ruleIdForContext, guard, error: new TypeError(errorMsg), bindings });
          throw new TypeError(errorMsg);
        }
      }
      return true;
    };
    const numericArgs = () => resolvedArgs.map(arg => typeof arg === 'boolean' ? (arg ? 1 : 0) : Number(arg));

    switch (op) {
      case '>': expectNumericOperands(op, resolvedArgs, 2); return numericArgs()[0] > numericArgs()[1];
      case '>=': expectNumericOperands(op, resolvedArgs, 2); return numericArgs()[0] >= numericArgs()[1];
      case '<': expectNumericOperands(op, resolvedArgs, 2); return numericArgs()[0] < numericArgs()[1];
      case '<=': expectNumericOperands(op, resolvedArgs, 2); return numericArgs()[0] <= numericArgs()[1];
      case '===': return resolvedArgs[0] === resolvedArgs[1]; // Strict equality, type matters
      case '!==': return resolvedArgs[0] !== resolvedArgs[1]; // Strict inequality
      case '+':
        if (resolvedArgs.some(arg => typeof arg === 'string')) return resolvedArgs.join(''); // String concat
        expectNumericOperands(op, resolvedArgs, resolvedArgs.length); return numericArgs().reduce((acc, val) => acc + val, 0);
      case '-': expectNumericOperands(op, resolvedArgs, resolvedArgs.length); return numericArgs().length === 1 ? -numericArgs()[0] : numericArgs()[0] - numericArgs()[1];
      case '*': expectNumericOperands(op, resolvedArgs, resolvedArgs.length); return numericArgs().reduce((acc, val) => acc * val, 1);
      case '/':
        expectNumericOperands(op, resolvedArgs, 2);
        if (numericArgs()[1] === 0) {
          const errorMsg = `Guard Error: Division by zero in rule [${ruleIdForContext || 'unknown'}].`;
          this.#emit('engine:guardError', { ruleId: ruleIdForContext, guard, error: new Error(errorMsg), bindings });
          throw new Error(errorMsg);
        }
        return numericArgs()[0] / numericArgs()[1];
      default:
        const errorMsg = `Guard Error: Unknown operator "${op}" in rule [${ruleIdForContext || 'unknown'}].`;
        this.#emit('engine:guardError', { ruleId: ruleIdForContext, guard, error: new Error(errorMsg), bindings });
        throw new Error(errorMsg);
    }
  }

  /** @private Transforms a binding set into a projected result object using a projection template. */
  #project(projection, bindings, queryIdForContext) {
    const result = {};
    for (const key in projection) {
      const template = projection[key];
      if (typeof template === 'object' && !Array.isArray(template) && template !== null) {
        result[key] = this.#project(template, bindings, queryIdForContext);
      } else {
        try {
          result[key] = this.#resolveGuardValue(template, bindings);
        } catch (e) {
          result[key] = undefined;
          this.#emit('engine:projectionError', { queryId: queryIdForContext, error: e, projectionKey: key, bindings });
        }
      }
    }
    return result;
  }

  /** @private Finds all rule activations for a given task (typically a fact assertion). */
  *#findMatches(task) { // task is {type: 'assert', fact: object}
    for (const rule of this.#definitions.values()) {
      if (rule.type === 'query') continue;
      yield* this.#checkRule(rule, rule.conditions);
    }
  }

  /**
   * @private Core recursive matching logic for rules and queries.
   * It iterates through conditions (patterns, accumulators, lacks), attempts to match them
   * against facts in FactStorage, accumulates bindings, and checks guards.
   * @param {object} ruleOrQuery - The rule or query definition object.
   * @param {Array<object|Array<*>>} conditions - The array of conditions to process.
   * @param {object} [initialBindings={}] - Bindings accumulated from previous conditions.
   * @param {Set<number>} [consumed=new Set()] - Set of fact IDs consumed by this match path.
   * @yields {{bindings: object, consumedFactIds: Set<number>}} An object with the final bindings
   * for a successful match and the set of fact IDs consumed.
   */
  *#checkRule(ruleOrQuery, conditions, initialBindings = {}, consumed = new Set()) {
    if (conditions.length === 0) {
      yield { bindings: initialBindings, consumedFactIds: consumed };
      return;
    }

    const [condition, ...remainingConditions] = conditions;

    if (condition._isLacksCondition) {
      const { pattern: lacksPatternObject } = condition;
      const factType = Object.keys(lacksPatternObject)[0];
      const pattern = lacksPatternObject[factType];
      let foundMatch = false;
      for (const fact of this.#factStorage.getFactsByType(factType)) {
        if (this.#matcher.match(pattern, fact, initialBindings).isMatch) {
          foundMatch = true;
          break;
        }
      }
      if (!foundMatch) {
        yield* this.#checkRule(ruleOrQuery, remainingConditions, initialBindings, consumed);
      }
    } else if (condition._isAccumulator) {
      const { from: fromPatternObject, accumulate, on: onField, into: intoVariable } = condition;
      const factType = Object.keys(fromPatternObject)[0];
      const pattern = fromPatternObject[factType];

      const sourceFacts = [];
      for (const fact of this.#factStorage.getFactsByType(factType)) {
        const matchResult = this.#matcher.match(pattern, fact, initialBindings);
        if (matchResult.isMatch) {
          sourceFacts.push(fact);
        }
      }
      // Assumes accumulators is globally available or imported
      const accumulatorFn = accumulators[accumulate](onField);
      const result = accumulatorFn(sourceFacts);
      const nextBindings = { ...initialBindings, [intoVariable]: result };
      yield* this.#checkRule(ruleOrQuery, remainingConditions, nextBindings, consumed);

    } else {
      const [patternObject, ...guards] = Array.isArray(condition) && typeof condition[0] === 'object'
        ? condition
        : [condition];

      const factType = Object.keys(patternObject)[0];
      const pattern = patternObject[factType];
      const candidateFacts = this.#factStorage.getFactsByType(factType);

      for (const fact of candidateFacts) {
        const matchResult = this.#matcher.match(pattern, fact, initialBindings);
        if (matchResult.isMatch) {
          try {
            const allGuardsPassed = guards.length === 0 ? true : guards.every(guard => this.#executeGuard(guard, matchResult.bindings, ruleOrQuery.id));
            if (allGuardsPassed) {
              const newConsumed = new Set(consumed).add(fact._id);
              yield* this.#checkRule(ruleOrQuery, remainingConditions, matchResult.bindings, newConsumed);
            }
          } catch (e) {
            // Error already emitted by #executeGuard if it's a known issue like div by zero or unknown op.
            // If it's a different error (e.g., variable not bound in #resolveGuardValue), it's caught here.
            // this.#emit('engine:guardError', { ruleId: ruleOrQuery?.id, condition: patternObject, guardExpression: guards, error: e, bindings: matchResult.bindings });
          }
        }
      }
    }
  }

  /**
   * Makes the engine instance itself asynchronously iterable, allowing rule execution
   * with `for await...of engine`. Each iteration yields a rule activation.
   * @async
   * @generator
   * @yields {{rule: object, bindings: object}}
   */
  async *[Symbol.asyncIterator]() { yield* this.run(); }
}