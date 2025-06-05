import { SimpleEventEmitter } from '../../src/utils/SimpleEventEmitter';

describe('SimpleEventEmitter', () => {
  let emitter;
  let consoleErrorSpy;

  beforeEach(() => {
    emitter = new SimpleEventEmitter();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('constructor', () => {
    test('should initialize with an empty listeners object', () => {
      expect(emitter.listeners).toEqual({});
    });
  });

  describe('on(eventName, listener)', () => {
    test('should register a listener for a new event', () => {
      const mockListener = jest.fn();
      emitter.on('testEvent', mockListener);
      expect(emitter.listeners['testEvent']).toContain(mockListener);
      expect(emitter.listeners['testEvent'].length).toBe(1);
    });

    test('should register multiple listeners for the same event', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      emitter.on('testEvent', listener1);
      emitter.on('testEvent', listener2);
      expect(emitter.listeners['testEvent']).toEqual([listener1, listener2]);
    });

    test('should not register if eventName is not a non-empty string', () => {
      const mockListener = jest.fn();
      emitter.on('', mockListener);
      emitter.on('   ', mockListener);
      emitter.on(null, mockListener);
      emitter.on(undefined, mockListener);
      emitter.on(123, mockListener);

      expect(emitter.listeners).toEqual({});
      expect(consoleErrorSpy).toHaveBeenCalledTimes(5);
      expect(consoleErrorSpy).toHaveBeenCalledWith("SimpleEventEmitter Error: Event name must be a non-empty string.");
    });

    test('should not register if listener is not a function', () => {
      emitter.on('testEvent', null);
      emitter.on('testEvent', 'not a function');
      emitter.on('testEvent', {});

      expect(emitter.listeners['testEvent']).toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
      expect(consoleErrorSpy).toHaveBeenCalledWith('SimpleEventEmitter Error: Listener for event "testEvent" must be a function.');
    });
  });

  describe('emit(eventName, data)', () => {
    test('should call all registered listeners for an event with data', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const eventData = { message: 'hello' };

      emitter.on('testEvent', listener1);
      emitter.on('testEvent', listener2);
      emitter.emit('testEvent', eventData);

      expect(listener1).toHaveBeenCalledWith(eventData);
      expect(listener2).toHaveBeenCalledWith(eventData);
    });

    test('should call listeners with undefined if no data is provided', () => {
      const mockListener = jest.fn();
      emitter.on('testEvent', mockListener);
      emitter.emit('testEvent');
      expect(mockListener).toHaveBeenCalledWith(undefined);
    });

    test('should not call listeners for other events', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      emitter.on('eventA', listener1);
      emitter.on('eventB', listener2);
      emitter.emit('eventA', 'dataA');

      expect(listener1).toHaveBeenCalledWith('dataA');
      expect(listener2).not.toHaveBeenCalled();
    });

    test('should do nothing if no listeners are registered for an event', () => {
      const listener1 = jest.fn();
      emitter.on('eventA', listener1);
      expect(() => emitter.emit('nonExistentEvent', 'data')).not.toThrow();
      expect(listener1).not.toHaveBeenCalled();
    });

    test('should log an error and continue if a listener throws an error', () => {
      const faultyListener = jest.fn(() => {
        throw new Error('Test error');
      });
      const healthyListener = jest.fn();

      emitter.on('testEvent', faultyListener);
      emitter.on('testEvent', healthyListener);
      emitter.emit('testEvent', 'data');

      expect(faultyListener).toHaveBeenCalledWith('data');
      expect(healthyListener).toHaveBeenCalledWith('data');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error in event listener for [testEvent]:',
        'Test error',
        expect.any(String) // For the stack trace
      );
    });

    test('should not emit if eventName is not a non-empty string', () => {
      const mockListener = jest.fn();
      emitter.on('validEvent', mockListener);

      emitter.emit('', 'data');
      emitter.emit('   ', 'data');
      emitter.emit(null, 'data');
      emitter.emit(undefined, 'data');
      emitter.emit(123, 'data');

      expect(mockListener).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledTimes(5);
      expect(consoleErrorSpy).toHaveBeenCalledWith("SimpleEventEmitter Error: Cannot emit event with an invalid name.");
    });

    test('should allow a listener to unregister itself during emit', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn(() => {
        emitter.off('testEvent', listener2); // Unregisters itself
      });
      const listener3 = jest.fn();

      emitter.on('testEvent', listener1);
      emitter.on('testEvent', listener2);
      emitter.on('testEvent', listener3);

      emitter.emit('testEvent', 'data');

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);

      expect(emitter.listeners['testEvent']).not.toContain(listener2);
      expect(emitter.listeners['testEvent']).toEqual([listener1, listener3]);

      // Emit again to ensure listener2 is not called
      listener1.mockClear();
      listener3.mockClear();
      emitter.emit('testEvent', 'data2');
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1); // Still 1 from previous emit
      expect(listener3).toHaveBeenCalledTimes(1);
    });
  });

  describe('off(eventName, listenerToRemove)', () => {
    test('should remove a specific listener for an event', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      emitter.on('testEvent', listener1);
      emitter.on('testEvent', listener2);

      const result = emitter.off('testEvent', listener1);
      expect(result).toBe(true);
      expect(emitter.listeners['testEvent']).toEqual([listener2]);
      expect(emitter.listeners['testEvent'].length).toBe(1);
    });

    test('should return false if the event does not exist', () => {
      const mockListener = jest.fn();
      expect(emitter.off('nonExistentEvent', mockListener)).toBe(false);
    });

    test('should return false if the listener does not exist for the event', () => {
      const listener1 = jest.fn();
      const nonExistentListener = jest.fn();
      emitter.on('testEvent', listener1);
      expect(emitter.off('testEvent', nonExistentListener)).toBe(false);
      expect(emitter.listeners['testEvent']).toEqual([listener1]);
    });

    test('should remove the event from listeners if it becomes empty', () => {
      const mockListener = jest.fn();
      emitter.on('testEvent', mockListener);
      emitter.off('testEvent', mockListener);
      expect(emitter.listeners['testEvent']).toBeUndefined();
    });

    test('should only remove the first instance of a listener if added multiple times', () => {
      const mockListener = jest.fn();
      emitter.on('testEvent', mockListener);
      emitter.on('testEvent', mockListener); // Added twice
      emitter.off('testEvent', mockListener);
      expect(emitter.listeners['testEvent']).toEqual([mockListener]);
    });
  });

  describe('removeAllListeners(eventName)', () => {
    test('should remove all listeners for a specific event', () => {
      const listenerA1 = jest.fn();
      const listenerA2 = jest.fn();
      const listenerB1 = jest.fn();

      emitter.on('eventA', listenerA1);
      emitter.on('eventA', listenerA2);
      emitter.on('eventB', listenerB1);

      emitter.removeAllListeners('eventA');
      expect(emitter.listeners['eventA']).toBeUndefined();
      expect(emitter.listeners['eventB']).toEqual([listenerB1]);
    });

    test('should remove all listeners for all events if no eventName is provided', () => {
      emitter.on('eventA', jest.fn());
      emitter.on('eventB', jest.fn());
      emitter.removeAllListeners();
      expect(emitter.listeners).toEqual({});
    });

    test('should do nothing if eventName is provided but does not exist', () => {
      emitter.on('eventA', jest.fn());
      emitter.removeAllListeners('nonExistentEvent');
      expect(emitter.listeners['eventA']).toBeDefined();
    });

    test('should log an error if an invalid argument is provided', () => {
      emitter.removeAllListeners(123);
      expect(consoleErrorSpy).toHaveBeenCalledWith("SimpleEventEmitter Error: Invalid argument for removeAllListeners. Expects a string or no argument.");
      
      emitter.removeAllListeners({});
      expect(consoleErrorSpy).toHaveBeenCalledWith("SimpleEventEmitter Error: Invalid argument for removeAllListeners. Expects a string or no argument.");
    });
  });

  describe('listenerCount(eventName)', () => {
    test('should return the number of listeners for a given event', () => {
      emitter.on('eventA', jest.fn());
      emitter.on('eventA', jest.fn());
      emitter.on('eventB', jest.fn());

      expect(emitter.listenerCount('eventA')).toBe(2);
      expect(emitter.listenerCount('eventB')).toBe(1);
    });

    test('should return 0 if no listeners are registered for an event', () => {
      expect(emitter.listenerCount('nonExistentEvent')).toBe(0);
    });

    test('should return 0 if eventName is not in listeners', () => {
      emitter.on('eventA', jest.fn());
      expect(emitter.listenerCount('eventC')).toBe(0);
    });
  });
});