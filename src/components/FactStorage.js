// src/components/FactStorage.js
/**
 * Manages the storage, indexing, and retrieval of facts within the engine.
 * Each fact is assigned a unique internal ID upon assertion.
 * Facts are simple JavaScript objects, but they must have a `type` property.
 * @export
 */
export class FactStorage {
  /** * Counter to generate unique fact IDs.
   * @private 
   * @type {number} 
   */
  #factIdCounter = 0;

  /** * Stores all facts, keyed by their unique internal ID.
   * The value is an entry containing the fact and its metadata.
   * @private 
   * @type {Map<number, {fact: object & {_id: number}, metadata: object}>} 
   */
  #facts = new Map();

  /** * A simple primary index for facts, organized by their 'type' property.
   * This allows for quick retrieval of all facts of a certain type.
   * `Map<factType, Map<factId, factObject>>`
   * @private 
   * @type {Map<string, Map<number, object & {_id: number}>>} 
   */
  #alphaNetwork = new Map();

  /**
   * Retrieves an iterator over all fact objects of a given type.
   * @param {string} type - The type of facts to retrieve.
   * @returns {IterableIterator<object & {_id: number}>} An iterator over the fact objects.
   * Returns an empty iterator if no facts of that type exist.
   */
  getFactsByType(type) {
    return this.#alphaNetwork.get(type)?.values() ?? [][Symbol.iterator]();
  }

  /**
   * Retrieves a single fact entry (the fact object and its associated metadata) 
   * by its internal, engine-assigned ID.
   * @param {number} id - The internal ID of the fact.
   * @returns {{fact: object & {_id: number}, metadata: object} | undefined} The fact entry 
   * (containing the fact and its metadata), or undefined if no fact with that ID is found.
   */
  getFactEntry(id) {
    return this.#facts.get(id);
  }

  /**
   * Asserts a new fact into the storage system.
   * A unique `_id` property is automatically assigned to the fact.
   * The fact must have a `type` property (string).
   * @param {object} fact - The fact data to assert. Must include a `type` property.
   * @param {object} [metadata={}] - Optional metadata to store alongside the fact 
   * (e.g., for Truth Maintenance System, rule production info).
   * @returns {{fact: object & {_id: number}, metadata: object} | null} The asserted fact entry 
   * (including its newly assigned `_id` and metadata), or null if the fact is invalid (e.g., missing `type`).
   */
  assert(fact, metadata = {}) {
    if (!fact || typeof fact.type !== 'string') {
      console.error("FactStorage Error: Fact must be an object and have a 'type' property of type string.");
      // In a production system, you might throw an error or have a more robust error handling/logging mechanism.
      return null;
    }
    const factId = ++this.#factIdCounter;
    // Ensure the original fact object is not mutated if it's passed around elsewhere.
    const newFact = { ...fact, _id: factId };

    const factEntry = { fact: newFact, metadata };
    this.#facts.set(factId, factEntry);

    // Update the alphaNetwork index by type.
    const factTypeIndex = this.#alphaNetwork.get(newFact.type);
    if (factTypeIndex) {
      factTypeIndex.set(factId, newFact);
    } else {
      this.#alphaNetwork.set(newFact.type, new Map([[factId, newFact]]));
    }
    return factEntry;
  }

  /**
   * Retracts (deletes) a fact from the storage by its internal ID.
   * @param {number} factId - The internal ID of the fact to retract.
   * @returns {{fact: object & {_id: number}, metadata: object} | null} The entry of the retracted fact 
   * (including its metadata), or null if no fact with that ID was found.
   */
  retract(factId) {
    const entry = this.#facts.get(factId);
    if (!entry) {
      return null;
    }

    this.#facts.delete(factId);

    // Remove from alphaNetwork index
    const factTypeIndex = this.#alphaNetwork.get(entry.fact.type);
    if (factTypeIndex) {
      factTypeIndex.delete(factId);
      if (factTypeIndex.size === 0) {
        this.#alphaNetwork.delete(entry.fact.type);
      }
    }

    return entry;
  }

  /** * Clears all facts and resets the internal ID counter. 
   * This method is primarily intended for use in testing environments 
   * to ensure a clean state between tests.
   */
  clear() {
    this.#factIdCounter = 0;
    this.#facts.clear();
    this.#alphaNetwork.clear();
    // console.log("FactStorage cleared."); // Optional: for debugging
  }
}