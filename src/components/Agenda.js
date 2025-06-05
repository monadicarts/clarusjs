/**
 * Manages the queue of pending tasks (fact assertions or retractions)
 * that the engine needs to process in a First-In, First-Out (FIFO) manner.
 * @export
 */
export class Agenda {
  /** * Stores the tasks.
   * @private 
   * @type {Array<object>} 
   */
  #tasks = [];

  /**
   * Checks if there are any tasks currently in the agenda.
   * @returns {boolean} True if the agenda is not empty, false otherwise.
   */
  get hasTasks() {
    return this.#tasks.length > 0;
  }

  /**
   * Adds a new task to the end of the agenda.
   * @param {object} task - The task object to add. 
   * Expected to have at least a `type` property (e.g., 'assert', 'retract')
   * and a `fact` property.
   */
  push(task) {
    this.#tasks.push(task);
  }

  /**
   * Removes and returns the next task from the beginning of the agenda.
   * @returns {object | undefined} The next task object, or undefined if the agenda is empty.
   */
  shift() {
    return this.#tasks.shift();
  }

  /**
   * Clears all tasks from the agenda. Primarily for resetting state or testing.
   */
  clear() {
    this.#tasks = [];
  }
}