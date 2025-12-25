import {type RefObject} from 'react';

/**
 * Registry for mapping string IDs to React Native refs.
 * Used when tour steps reference targets by string ID instead of direct refs.
 */
class TargetRegistry {
  private readonly targets = new Map<string, RefObject<unknown>>();

  /**
   * Registers a target with the given ID.
   * @param id - Unique identifier for the target
   * @param ref - React ref to the target component
   */
  register(id: string, ref: RefObject<unknown>): void {
    this.targets.set(id, ref);
  }

  /**
   * Unregisters a target by ID.
   * @param id - The target ID to remove
   */
  unregister(id: string): void {
    this.targets.delete(id);
  }

  /**
   * Gets the ref for a registered target ID.
   * @param id - The target ID to look up
   * @returns The ref if found, undefined otherwise
   */
  get(id: string): RefObject<unknown> | undefined {
    return this.targets.get(id);
  }

  /**
   * Clears all registered targets.
   */
  clear(): void {
    this.targets.clear();
  }
}

/**
 * Global target registry instance.
 * Shared across all TourProvider instances in the app.
 */
export const targetRegistry = new TargetRegistry();
