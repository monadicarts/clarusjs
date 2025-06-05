/**
 * @file This is the main entry point for the Clarus.js rule engine library.
 * It exports all the public classes, functions, and constants that users of the
 * library will interact with to define, manage, and run rules and queries.
 *
 * @module Clarus
 * @exports LeapEngine
 * @exports Rule
 * @exports Query
 * @exports deftemplate // Note: deftemplate, getTemplate, clearAllTemplates are all exported
 * @exports _ // The pattern helper object, often used in 'when' clauses
 * @exports ANY
 * @exports FactStorage
 * @exports Agenda
 * @exports AdvancedMatcher
 * @exports SalienceConflictResolver
 * @exports accumulators
 * @exports SimpleEventEmitter
 * @exports getTemplate
 * @exports clearAllTemplates
 */

// --- Core Engine ---
/**
 * The main rule engine class.
 * @see {@link ./engine/LeapEngine.js} for detailed documentation.
 */
export { LeapEngine } from './engine/LeapEngine.js';

// --- DSL Builders & Helpers ---
/**
 * Fluent builder for creating rule definitions.
 * @see {@link ./dsl/RuleBuilder.js} for detailed documentation.
 * @example const myRule = Rule('MyRuleId').when(...).then(...).build();
 */
export { Rule } from './dsl/RuleBuilder.js';

/**
 * Fluent builder for creating query definitions.
 * @see {@link ./dsl/QueryBuilder.js} for detailed documentation.
 * @example const myQuery = Query('FindUsers').when(...).select(...).build();
 */
export { Query } from './dsl/QueryBuilder.js';

/**
 * Function for defining fact schemas with validation.
 * @see {@link ./dsl/templates.js} for detailed documentation.
 * @example const userTemplate = deftemplate('user', { id: { type: 'string', required: true } });
 */
export { clearAllTemplates, deftemplate, getTemplate } from './dsl/templates.js';

/**
 * The primary helper object (shorthand `_`) for building rule/query conditions,
 * guards, projections, and accumulators.
 * @see {@link ./dsl/pattern-helpers.js} for detailed documentation on all available operators.
 * @example _.gt(100), _.from({type:'order'}).count().into('?c')
 */
export { _ } from './dsl/pattern-helpers.js'; // This exports the `_` object directly

// --- Core Components (Exposed for advanced use or dependency injection) ---
/**
 * Manages the storage and indexing of facts.
 * @see {@link ./components/FactStorage.js} for detailed documentation.
 */
export { FactStorage } from './components/FactStorage.js';

/**
 * Manages the queue of pending tasks for the engine.
 * @see {@link ./components/Agenda.js} for detailed documentation.
 */
export { Agenda } from './components/Agenda.js';

// --- Strategies (Exposed for advanced use or custom implementations) ---
/**
 * Performs advanced pattern matching of rule conditions against facts.
 * Also exports the `ANY` wildcard symbol.
 * @see {@link ./strategies/AdvancedMatcher.js} for detailed documentation.
 */
export { AdvancedMatcher, ANY } from './strategies/AdvancedMatcher.js';

/**
 * Conflict resolution strategy that prioritizes rules based on salience.
 * @see {@link ./strategies/SalienceConflictResolver.js} for detailed documentation.
 */
export { SalienceConflictResolver } from './strategies/SalienceConflictResolver.js';

/**
 * Collection of built-in accumulator functions for data aggregation in rules/queries.
 * @see {@link ./strategies/Accumulators.js} for detailed documentation.
 */
export { accumulators } from './strategies/Accumulators.js';

// --- Utilities ---
/**
 * A basic event emitter class for engine lifecycle events.
 * @see {@link ./utils/SimpleEventEmitter.js} for detailed documentation.
 */
export { SimpleEventEmitter } from './utils/SimpleEventEmitter.js';

// --- Custom Errors (Example - if you had defined any for your library) ---
// /**
// * Example of exporting a custom error type.
// * @example throw new OrderProcessingError("Stock unavailable", orderId);
// */
// export { OrderProcessingError } from './your-custom-errors.js'; // If you create a dedicated error file
