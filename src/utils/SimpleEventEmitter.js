/**
 * @file Defines the SimpleEventEmitter class, a basic event emitter implementation.
 * This utility allows for registering event listeners and emitting events with data,
 * forming the basis of the Clarus.js engine's observability and hook system.
 * @module utils/SimpleEventEmitter
 */

/**
 * A basic event emitter class that allows for registering listeners for named events
 * and emitting data to those listeners. It's designed to be a lightweight,
 * dependency-free way to implement an event-driven architecture within the engine.
 * @export
 * @class SimpleEventEmitter
 */
export class SimpleEventEmitter {
  /**
   * Initializes a new SimpleEventEmitter instance.
   * The listeners are stored in an internal object, mapping event names to arrays of listener functions.
   */
  constructor() {
    /**
     * Stores all registered event listeners.
     * The keys are event names (strings), and the values are arrays of listener functions.
     * @private
     * @type {Object<string, Array<function(data: any): void>>}
     */
    this.listeners = {};
  }

  /**
   * Registers a listener function for a given event name.
   * If multiple listeners are registered for the same event, they will be called
   * in the order they were registered.
   *
   * @param {string} eventName - The name of the event to listen for (e.g., 'fact:asserted', 'rule:fired').
   * @param {function(data: any): void} listener - The callback function to execute when the event is emitted.
   * This function will receive the data payload associated with the event.
   * @returns {void}
   * @example
   * const emitter = new SimpleEventEmitter();
   * emitter.on('user:login', (userData) => {
   * console.log('User logged in:', userData.username);
   * });
   */
  on(eventName, listener) {
    if (typeof eventName !== 'string' || eventName.trim() === '') {
      console.error("SimpleEventEmitter Error: Event name must be a non-empty string.");
      return;
    }
    if (typeof listener !== 'function') {
      console.error(`SimpleEventEmitter Error: Listener for event "${eventName}" must be a function.`);
      return;
    }

    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName].push(listener);
  }

  /**
   * Emits an event, calling all registered listeners for that event name with the provided data.
   * If a listener throws an error, it will be caught and logged to the console,
   * allowing other listeners for the same event to still be executed.
   *
   * @param {string} eventName - The name of the event to emit.
   * @param {any} [data] - The data payload to pass to each listener function.
   * @returns {void}
   * @example
   * emitter.emit('user:login', { username: 'Alice', timestamp: Date.now() });
   */
  emit(eventName, data) {
    if (typeof eventName !== 'string' || eventName.trim() === '') {
      console.error("SimpleEventEmitter Error: Cannot emit event with an invalid name.");
      return;
    }

    const eventListeners = this.listeners[eventName];
    if (eventListeners && eventListeners.length > 0) {
      // Iterate over a copy of the listeners array in case a listener modifies the array (e.g., unregisters itself)
      [...eventListeners].forEach(listener => {
        try {
          listener(data);
        } catch (e) {
          // Log the error but don't let one faulty listener stop others.
          console.error(`Error in event listener for [${eventName}]:`, e.message, e.stack);
        }
      });
    }
  }

  /**
   * Removes a specific listener for a given event name.
   * If the same listener function has been added multiple times, only the first instance found will be removed.
   *
   * @param {string} eventName - The name of the event from which to remove the listener.
   * @param {function(data: any): void} listenerToRemove - The specific listener function to remove.
   * @returns {boolean} True if a listener was removed, false otherwise (e.g., event or listener not found).
   * @example
   * const myCallback = (data) => console.log(data);
   * emitter.on('myEvent', myCallback);
   * emitter.off('myEvent', myCallback); // Removes the listener
   */
  off(eventName, listenerToRemove) {
    if (!this.listeners[eventName]) {
      return false;
    }
    const index = this.listeners[eventName].indexOf(listenerToRemove);
    if (index > -1) {
      this.listeners[eventName].splice(index, 1);
      if (this.listeners[eventName].length === 0) {
        delete this.listeners[eventName]; // Clean up empty listener arrays
      }
      return true;
    }
    return false;
  }

  /**
   * Removes all listeners for a specific event name, or all listeners for all events if no event name is provided.
   *
   * @param {string} [eventName] - Optional. The name of the event for which to remove all listeners.
   * If omitted, all listeners for all events will be removed.
   * @returns {void}
   * @example
   * emitter.removeAllListeners('user:login'); // Removes all listeners for 'user:login'
   * emitter.removeAllListeners(); // Removes all listeners for all events
   */
  removeAllListeners(eventName) {
    if (eventName && typeof eventName === 'string') {
      if (this.listeners[eventName]) {
        delete this.listeners[eventName];
      }
    } else if (eventName === undefined) {
      this.listeners = {};
    } else {
      console.error("SimpleEventEmitter Error: Invalid argument for removeAllListeners. Expects a string or no argument.");
    }
  }

  /**
   * Gets the number of listeners for a specific event.
   * @param {string} eventName - The name of the event.
   * @returns {number} The number of listeners registered for the event.
   */
  listenerCount(eventName) {
    return this.listeners[eventName] ? this.listeners[eventName].length : 0;
  }
}
