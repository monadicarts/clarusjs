/**
 * @file Defines the SalienceConflictResolver class.
 * This strategy resolves conflicts among multiple activated rules by selecting
 * the rule with the highest salience (priority) value.
 * @module strategies/SalienceConflictResolver
 */

/**
 * A conflict resolution strategy that prioritizes rules based on their 'salience' property.
 * Rules with higher salience values are chosen to fire first. If multiple rules share
 * the highest salience, this resolver will pick the first one encountered in the
 * iteration of activated rules (this provides a stable, though simple, tie-breaking mechanism).
 *
 * Rules without an explicit `salience` property are treated as having a salience of `0`.
 * @export
 * @class SalienceConflictResolver
 */
export class SalienceConflictResolver {
  /**
   * Resolves which rule activation should fire from a set of potential matches
   * based on rule salience.
   *
   * @param {IterableIterator<{rule: {id: string, salience?: number, [key: string]: any}, bindings: object, consumedFactIds: Set<number>}>} matchIterator - An iterator
   * yielding all current activations. Each activation object contains the `rule` definition
   * (which should include an optional `salience` property), the `bindings` for that match,
   * and the set of `consumedFactIds`.
   * @returns {{rule: {id: string, salience?: number, [key: string]: any}, bindings: object, consumedFactIds: Set<number>} | null}
   * The highest priority activation object, or `null` if the `matchIterator` yields no activations.
   *
   * @example
   * // (Inside the LeapEngine)
   * // const matchIterator = this.#findMatches(task);
   * // const activationToFire = salienceResolver.resolve(matchIterator);
   * // if (activationToFire) {
   * //   // Proceed to execute activationToFire.rule.then(...)
   * // }
   */
  resolve(matchIterator) {
    const activations = [...matchIterator]; // Convert iterator to an array to process all

    if (activations.length === 0) {
      return null; // No rules activated, nothing to resolve.
    }
    if (activations.length === 1) {
      return activations[0]; // Only one rule activated, no conflict.
    }

    // Group activations by their salience value.
    // Rules without a salience property default to 0.
    const groupedBySalience = activations.reduce((groups, activation) => {
      const salience = activation.rule.salience !== undefined && typeof activation.rule.salience === 'number'
        ? activation.rule.salience
        : 0;
      if (!groups[salience]) {
        groups[salience] = [];
      }
      groups[salience].push(activation);
      return groups;
    }, {});

    // Find the highest salience value among the groups.
    const salienceLevels = Object.keys(groupedBySalience).map(Number);
    const highestSalience = Math.max(...salienceLevels);

    // Return the first activation found in the highest salience group.
    // This provides a basic tie-breaking mechanism (first-come, first-served within the highest salience).
    // More complex tie-breaking (e.g., rule complexity, recency of facts) could be added here if needed.
    return groupedBySalience[highestSalience][0];
  }
}
