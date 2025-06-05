// __tests__/dsl/templates.test.js
import { deftemplate, getTemplate, clearAllTemplates } from '../../src/dsl/templates';
import { _ } from '../../src/dsl/pattern-helpers'; // For using in schema.validate examples

describe('Templates (deftemplate)', () => {
  beforeEach(() => {
    clearAllTemplates(); // Ensure a clean state for each test
  });

  afterAll(() => {
    clearAllTemplates(); // Clean up after all tests in this suite
  });

  describe('deftemplate definition', () => {
    test('should define a template with a name and schema', () => {
      const userSchema = {
        id: { type: 'string', required: true },
        name: { type: 'string' },
      };
      const userTemplate = deftemplate('user', userSchema);

      expect(userTemplate.name).toBe('user');
      expect(userTemplate.schema).toEqual(userSchema);
      expect(typeof userTemplate.create).toBe('function');

      const retrievedTemplate = getTemplate('user');
      expect(retrievedTemplate).toEqual({ name: 'user', schema: userSchema });
    });

    test('should throw if template name is invalid', () => {
      expect(() => deftemplate('', {})).toThrow('deftemplate Error: Template name must be a non-empty string.');
      expect(() => deftemplate('   ', {})).toThrow('deftemplate Error: Template name must be a non-empty string.');
      expect(() => deftemplate(null, {})).toThrow('deftemplate Error: Template name must be a non-empty string.');
      expect(() => deftemplate(123, {})).toThrow('deftemplate Error: Template name must be a non-empty string.');
    });

    test('should throw if schema is not an object', () => {
      expect(() => deftemplate('test', 'not-an-object')).toThrow("deftemplate Error: Schema for template 'test' must be an object.");
      expect(() => deftemplate('test', null)).toThrow("deftemplate Error: Schema for template 'test' must be an object.");
    });

    test('should allow defining a template with an empty schema', () => {
      const emptyTemplate = deftemplate('empty', {});
      expect(emptyTemplate.name).toBe('empty');
      expect(emptyTemplate.schema).toEqual({});
      expect(getTemplate('empty')).toEqual({ name: 'empty', schema: {} });
    });

    test('should throw if a field schema is not an object', () => {
      const invalidSchema = { id: 'string' }; // Field schema should be an object
      expect(() => deftemplate('badField', invalidSchema))
        .toThrow("deftemplate Error: Template 'badField', field 'id': Schema definition for a field must be an object.");
    });

    test("should throw if a field schema is missing 'type'", () => {
      const schemaMissingType = { id: { required: true } };
      expect(() => deftemplate('noType', schemaMissingType))
        .toThrow("deftemplate Error: Template 'noType', field 'id': A 'type' (non-empty string) is required in its schema definition.");
    });

    test("should throw if a field schema 'type' is not a non-empty string", () => {
      const schemaInvalidType1 = { id: { type: '' } };
      expect(() => deftemplate('invalidType1', schemaInvalidType1))
        .toThrow("deftemplate Error: Template 'invalidType1', field 'id': A 'type' (non-empty string) is required in its schema definition.");
      const schemaInvalidType2 = { id: { type: 123 } };
      expect(() => deftemplate('invalidType2', schemaInvalidType2))
        .toThrow("deftemplate Error: Template 'invalidType2', field 'id': A 'type' (non-empty string) is required in its schema definition.");
    });

    test("should throw if a field schema 'validate' is not a function", () => {
      const schemaInvalidValidate = { id: { type: 'string', validate: 'not-a-function' } };
      expect(() => deftemplate('invalidValidate', schemaInvalidValidate))
        .toThrow("deftemplate Error: Template 'invalidValidate', field 'id': 'validate' property, if provided, must be a function.");
    });

    test("should throw if a field schema 'required' is not a boolean", () => {
      const schemaInvalidRequired = { id: { type: 'string', required: 'yes' } };
      expect(() => deftemplate('invalidRequired', schemaInvalidRequired))
        .toThrow("deftemplate Error: Template 'invalidRequired', field 'id': 'required' property, if provided, must be a boolean.");
    });

    test('should warn if default function is provided for a required field', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });
      deftemplate('warnTest', {
        field: { type: 'string', required: true, default: () => 'defaultVal' }
      });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "deftemplate Warning: Template 'warnTest', field 'field': Defining a 'default' function for a 'required' field. The 'required' check will apply to the value after the default is potentially applied."
      );
      consoleWarnSpy.mockRestore();
    });

    test('should allow complex schema with various field types and constraints', () => {
      const addressSchema = {
        street: { type: 'string', required: true },
        city: { type: 'string', required: true },
      };
      deftemplate('address', addressSchema); // Define nested template

      const complexSchema = {
        uuid: { type: 'string', required: true, validate: _.startsWith('id_') },
        count: { type: 'number', default: 0, validate: _.gte(0) },
        isActive: { type: 'boolean', default: true },
        tags: { type: 'array', default: () => ['defaultTag'] },
        config: { type: 'object' },
        nestedAddress: { type: 'address', required: false }, // Using another template name as type
        anyValue: { type: 'any' }
      };
      const complexTemplate = deftemplate('complex', complexSchema);
      expect(complexTemplate.name).toBe('complex');
      expect(getTemplate('complex').schema).toEqual(complexSchema);
    });
  });

  describe('template.create()', () => {
    test('should create a fact object with the correct type and provided data', () => {
      const itemTemplate = deftemplate('item', {
        name: { type: 'string' },
        price: { type: 'number' },
      });
      const itemData = { name: 'Test Item', price: 9.99, extra: 'info' };
      const createdFact = itemTemplate.create(itemData);

      expect(createdFact).toEqual({
        type: 'item',
        name: 'Test Item',
        price: 9.99,
        extra: 'info',
      });
    });

    test('create() should work with empty data', () => {
      const simpleTemplate = deftemplate('simple', {});
      const createdFact = simpleTemplate.create({});
      expect(createdFact).toEqual({ type: 'simple' });
    });

    test('create() should overwrite a type property in data if present', () => {
      const myTemplate = deftemplate('myType', {});
      const dataWithWrongType = { type: 'wrongType', value: 1 };
      const createdFact = myTemplate.create(dataWithWrongType);
      expect(createdFact).toEqual({ type: 'myType', value: 1 });
    });
  });

  describe('getTemplate()', () => {
    test('should return undefined if template name does not exist', () => {
      expect(getTemplate('nonExistentTemplate')).toBeUndefined();
    });

    test('should retrieve a previously defined template', () => {
      const schema = { field: { type: 'string' } };
      deftemplate('exists', schema);
      const retrieved = getTemplate('exists');
      expect(retrieved).toBeDefined();
      expect(retrieved.name).toBe('exists');
      expect(retrieved.schema).toEqual(schema);
    });
  });

  describe('clearAllTemplates()', () => {
    test('should clear all defined templates', () => {
      deftemplate('temp1', { f: { type: 'string' } });
      deftemplate('temp2', { g: { type: 'number' } });

      expect(getTemplate('temp1')).toBeDefined();
      expect(getTemplate('temp2')).toBeDefined();

      clearAllTemplates();

      expect(getTemplate('temp1')).toBeUndefined();
      expect(getTemplate('temp2')).toBeUndefined();
    });

    test('calling clearAllTemplates when no templates exist should not error', () => {
      expect(() => clearAllTemplates()).not.toThrow();
    });
  });
});
