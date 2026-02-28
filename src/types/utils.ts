/**
 * Utility types shared across utils modules
 */

export interface MergeByKeyOptions<TItem, TKey> {
  /** Returns the key used to merge items. */
  readonly getKey: (item: TItem) => TKey;
  /** Merge strategy when the key already exists (defaults to last-in-wins). */
  readonly merge?: (existing: TItem, incoming: TItem) => TItem;
}
