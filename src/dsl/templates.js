/**
 * @file Defines the `deftemplate` system for creating fact schemas
 * and enabling data validation within the Clarus.js rule engine.
 * Templates define the expected structure, types, and constraints for facts,
 * enhancing data integrity and rule robustness.
 */

// It's assumed that the `_` (when) helper object would be imported or globally available
// if used within the `validate` predicates of a schema definition by the user.
// e.g., import { _ } from './pattern-helpers.js'; // If _ is used in schema.validate

/**
 * A private module-level Map to store all defined templates.
 * The engine will use `getTemplate` to access these.
 * @private
 * @type {Map<string, {name: string, schema: object}>}
 */
const TEMPLATES = new Map();

/**
 * Defines a new fact template with an associated schema for validation.
 * Facts asserted with a `type` matching a template name will be validated
 * against this schema by the engine's `assertFact` method.
 *
 * @export
 * @param {string} name - The unique name for this template. This name will be used
 * as the `type` property for facts conforming to this template.
 * @param {object} [schema={}] - An object defining the schema for the template.
 * Each key in the schema object is a field name in the fact.
 * The value for each field is a configuration object with the following optional properties:
 * @param {string} schema.fieldName.type - (Required) The expected JavaScript type
 * (e.g., 'string', 'number', 'boolean', 'array', 'object', 'any').
 * Can also be the name of another `deftemplate` for basic nested type checking (the engine's
 * `assertFact` would need to recursively validate if deep nested validation is desired).
 * @param {boolean} [schema.fieldName.required=false] - If true, the field must be present in the fact
 * (after defaults are applied).
 * @param {*|function():*} [schema.fieldName.default] - A default value to use if the field is
 * missing upon assertion. Can be a literal value or a function that returns a value.
 * @param {function(*):boolean} [schema.fieldName.validate] - A predicate function
 * (often from the `_` helpers, e.g., `_.gt(0)`) that the field's value must pass
 * if the field is present.
 * @returns {{name: string, schema: object, create: function(object): object}}
 * A template object containing its name, schema, and a `create` helper function.
 * The `create(data)` function helps construct fact objects of this template type
 * by automatically adding the `type: name` property.
 * @throws {Error} If the template name is invalid, the schema is not an object,
 * or if a field definition in the schema is malformed (e.g., missing `type`,
 * invalid `validate` type).
 * @example
 * const userTemplate = deftemplate('user', {
 * id: { type: 'string', required: true, validate: _.startsWith('usr_') },
 * email: { type: 'string', required: true, validate: _.matches(/@.+\..+/) },
 * age: { type: 'number', default: 18, validate: _.gte(0) },
 * tags: { type: 'array', default: () => [] },
 * address: { type: 'addressTemplate', required: false } // Example of nested template type
 * });
 *
 * const newUserFact = userTemplate.create({
 * id: 'usr_123',
 * email: 'test@example.com',
 * age: 30
 * });
 * // newUserFact will be:
 * // { type: 'user', id: 'usr_123', email: 'test@example.com', age: 30 }
 * // (tags would use its default if not provided)
 */
export function deftemplate(name, schema = {}) {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error("deftemplate Error: Template name must be a non-empty string.");
  }
  if (typeof schema !== 'object' || schema === null) {
    throw new Error(`deftemplate Error: Schema for template '${name}' must be an object.`);
  }

  // Validate the structure of the schema definition itself
  for (const fieldName in schema) {
    if (!Object.prototype.hasOwnProperty.call(schema, fieldName)) continue;

    const fieldSchema = schema[fieldName];
    if (typeof fieldSchema !== 'object' || fieldSchema === null) {
      throw new Error(`deftemplate Error: Template '${name}', field '${fieldName}': Schema definition for a field must be an object.`);
    }
    if (!fieldSchema.type || typeof fieldSchema.type !== 'string' || fieldSchema.type.trim() === '') {
      throw new Error(`deftemplate Error: Template '${name}', field '${fieldName}': A 'type' (non-empty string) is required in its schema definition.`);
    }
    if (fieldSchema.validate !== undefined && typeof fieldSchema.validate !== 'function') {
      throw new Error(`deftemplate Error: Template '${name}', field '${fieldName}': 'validate' property, if provided, must be a function.`);
    }
    if (fieldSchema.default !== undefined && typeof fieldSchema.default === 'function' && fieldSchema.required) {
      // This is a soft warning, not an error. A default on a required field is unusual but not strictly invalid.
      // The 'required' check in assertFact happens *after* defaults are applied.
      console.warn(`deftemplate Warning: Template '${name}', field '${fieldName}': Defining a 'default' function for a 'required' field. The 'required' check will apply to the value after the default is potentially applied.`);
    }
    if (fieldSchema.required !== undefined && typeof fieldSchema.required !== 'boolean') {
      throw new Error(`deftemplate Error: Template '${name}', field '${fieldName}': 'required' property, if provided, must be a boolean.`);
    }
  }

  TEMPLATES.set(name, { name, schema });
  // console.log(`--- Template Defined: ${name} ---`); // Optional: for debugging
  return {
    name,
    schema,
    /**
     * Helper function to create a fact object conforming to this template's type.
     * It automatically adds the `type: name` property to the provided data.
     * Note: This `create` method does NOT perform validation; validation occurs
     * when the fact is asserted into the engine via `engine.assertFact()`.
     * @param {object} data - The data for the fact, excluding the `type`.
     * @returns {object} A fact object with the `type` property set to the template name.
     */
    create: (data) => ({ ...data, type: name })
  };
}

/**
 * Retrieves a processed template definition by its name.
 * This is used internally by the LeapEngine during fact assertion for validation.
 * @export
 * @param {string} name - The name of the template to retrieve.
 * @returns {{name: string, schema: object} | undefined} The template definition object
 * (containing its name and schema), or undefined if no template with that name exists.
 */
export const getTemplate = (name) => TEMPLATES.get(name);

/**
 * Clears all defined templates from the internal storage.
 * This method is primarily intended for use in testing environments
 * to ensure a clean state between test suites or individual test files,
 * preventing template definition conflicts.
 * @export
 */
export const clearAllTemplates = () => {
  TEMPLATES.clear();
  // console.log("--- All Templates Cleared ---"); // Optional: for debugging
};
