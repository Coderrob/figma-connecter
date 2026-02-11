/**
 * Copyright (c) 2026 Robert Lindley
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Merge-By-Key Utility
 *
 * Provides a stable way to merge arrays into a Map keyed by a selector.
 *
 * @module utils/merge-by-key
 */

export interface MergeByKeyOptions<TItem, TKey> {
  /** Returns the key used to merge items. */
  readonly getKey: (item: TItem) => TKey;
  /** Merge strategy when the key already exists (defaults to last-in-wins). */
  readonly merge?: (existing: TItem, incoming: TItem) => TItem;
}

/**
 * Merges a list of items into a Map keyed by the provided selector.
 * Uses insertion order for deterministic iteration.
 *
 * @param items - Items to merge into the map.
 * @param options - Key selector and merge strategy.
 * @returns Map of merged items keyed by the selector.
 */
export function mergeByKey<TItem, TKey>(
  items: readonly TItem[],
  options: MergeByKeyOptions<TItem, TKey>,
): Map<TKey, TItem> {
  const map = new Map<TKey, TItem>();
  const merge = options.merge ?? ((_existing, incoming) => incoming);

  for (const item of items) {
    const key = options.getKey(item);
    if (map.has(key)) {
      const existing = map.get(key) as TItem;
      map.set(key, merge(existing, item));
    } else {
      map.set(key, item);
    }
  }

  return map;
}
