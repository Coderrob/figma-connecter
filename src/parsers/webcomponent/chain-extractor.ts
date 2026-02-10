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
 * Class Chain Extractor
 *
 * Applies per-class extractors across an inheritance chain and merges results deterministically.
 *
 * @module parsers/webcomponent/chain-extractor
 */

import ts from 'typescript';

import { mergeByKey } from '../../utils/merge-by-key';

/**
 * Aggregated extraction results for a class chain.
 */
export interface ChainExtractionResult<TItem> {
  /** Extracted items merged by key. */
  readonly items: readonly TItem[];
  /** Warnings produced during extraction. */
  readonly warnings: readonly string[];
}

/**
 * Options for extracting and merging items across a class chain.
 */
export interface ChainExtractorOptions<TItem> {
  /** Extractor applied to each class in the chain. */
  readonly extract: (classNode: ts.ClassLikeDeclaration) => ChainExtractionResult<TItem>;
  /** Key selector for deterministic merging. */
  readonly getKey: (item: TItem) => string;
  /** Optional merge strategy when keys collide. */
  readonly merge?: (existing: TItem, incoming: TItem) => TItem;
}

/**
 * Applies an extractor across the class chain and merges items by key.
 *
 * @param classChain - Ordered class chain (base to derived).
 * @param options - Extraction and merge options.
 * @returns Aggregated items and warnings.
 */
export const extractFromChain = <TItem>(
  classChain: readonly ts.ClassLikeDeclaration[],
  options: ChainExtractorOptions<TItem>,
): ChainExtractionResult<TItem> => {
  const results = classChain.map(options.extract);
  const collected = results.flatMap((result) => result.items);
  const warnings = results.flatMap((result) => result.warnings);

  const merged = mergeByKey(collected, {
    getKey: options.getKey,
    merge: options.merge,
  });

  return {
    items: Array.from(merged.values()),
    warnings,
  };
};
