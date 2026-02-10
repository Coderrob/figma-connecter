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
 * @fileoverview Shared assertion helpers for targeted test validation.
 */

/**
 * Asserts that all fragments are present in the content.
 *
 * @param content - Text content to inspect.
 * @param fragments - Required string fragments.
 */
export function expectContainsAll(content: string, fragments: readonly string[]): void {
  for (const fragment of fragments) {
    expect(content).toContain(fragment);
  }
}

/**
 * Asserts that fragments appear in order within the content.
 *
 * @param content - Text content to inspect.
 * @param fragments - Ordered string fragments.
 */
export function expectContainsInOrder(content: string, fragments: readonly string[]): void {
  let cursor = -1;
  for (const fragment of fragments) {
    const nextIndex = content.indexOf(fragment);
    expect(nextIndex).toBeGreaterThan(-1);
    expect(nextIndex).toBeGreaterThan(cursor);
    cursor = nextIndex;
  }
}

/**
 * Asserts that two key lists match after sorting.
 *
 * @param actual - Actual key list.
 * @param expected - Expected key list.
 */
export function expectKeysEqual(actual: readonly string[], expected: readonly string[]): void {
  const sortedActual = [...actual].sort((a, b) => a.localeCompare(b));
  const sortedExpected = [...expected].sort((a, b) => a.localeCompare(b));
  expect(sortedActual).toEqual(sortedExpected);
}

/**
 * Asserts that generated section markers are present.
 *
 * @param content - Text content to inspect.
 */
export function expectGeneratedSectionMarkers(content: string): void {
  expectContainsAll(content, [
    '// BEGIN GENERATED: props',
    '// END GENERATED: props',
    '// BEGIN GENERATED: example',
    '// END GENERATED: example',
  ]);
}
