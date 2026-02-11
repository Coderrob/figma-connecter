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
 * @fileoverview Tests for mergeByKey utility.
 */

import { mergeByKey } from '../../src/utils/merge-by-key';

describe('mergeByKey', () => {
  describe('positive cases', () => {
    it('should merge items by key with last-in-wins values', () => {
      const items = [
        { id: 'alpha', value: 1 },
        { id: 'beta', value: 2 },
        { id: 'alpha', value: 3 },
      ];

      const merged = mergeByKey(items, {
        getKey: (item) => item.id,
      });

      expect(Array.from(merged.values())).toEqual([
        { id: 'alpha', value: 3 },
        { id: 'beta', value: 2 },
      ]);
    });

    it('should apply custom merge strategy for duplicate keys', () => {
      const items = [
        { id: 'sum', value: 2 },
        { id: 'sum', value: 3 },
      ];

      const merged = mergeByKey(items, {
        getKey: (item) => item.id,
        merge: (existing, incoming) => ({
          id: existing.id,
          value: existing.value + incoming.value,
        }),
      });

      expect(Array.from(merged.values())).toEqual([{ id: 'sum', value: 5 }]);
    });
  });

  describe('edge cases', () => {
    it('should return empty map for empty input', () => {
      const merged = mergeByKey([], {
        getKey: (item: { id: string }) => item.id,
      });

      expect(merged.size).toBe(0);
    });
  });
});
