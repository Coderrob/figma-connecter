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
 * @module parsers/webcomponent/shared/chain-extractor
 */

import { mergeByKey } from "@/src/utils/merge-by-key";

import ts from "typescript";

export interface IChainExtractionResult<TItem> {
  readonly items: readonly TItem[];
  readonly warnings: readonly string[];
}

export interface IChainExtractorOptions<TItem> {
  readonly extract: (
    classNode: ts.ClassLikeDeclaration,
  ) => IChainExtractionResult<TItem>;
  readonly getKey: (item: TItem) => string;
  readonly merge?: (existing: TItem, incoming: TItem) => TItem;
}

/**
 * Applies the configured extractor to a class node.
 *
 * @param options - Chain extraction options.
 * @param classNode - Class node to process.
 * @returns Extraction result for the class node.
 */
function extractForClassNode<TItem>(
  options: Readonly<IChainExtractorOptions<TItem>>,
  classNode: Readonly<ts.ClassLikeDeclaration>,
): IChainExtractionResult<TItem> {
  return options.extract(classNode);
}

/**
 * Applies an extractor across the class chain and merges items by key.
 *
 * @param classChain - Ordered class chain.
 * @param options - Extraction and merge options.
 * @returns Aggregated items and warnings.
 */
export function extractFromChain<TItem>(
  classChain: readonly ts.ClassLikeDeclaration[],
  options: Readonly<IChainExtractorOptions<TItem>>,
): IChainExtractionResult<TItem> {
  let collected: TItem[] = [];
  let warnings: string[] = [];

  for (const classNode of classChain) {
    const result = extractForClassNode(options, classNode);
    collected = [...collected, ...selectExtractedItems(result)];
    warnings = [...warnings, ...selectWarnings(result)];
  }

  const merged = mergeByKey(collected, {
    getKey: options.getKey,
    merge: options.merge,
  });

  return {
    items: Array.from(merged.values()),
    warnings,
  };
}

/**
 * Selects extracted items from a chain extraction result.
 *
 * @param result - Extraction result.
 * @returns Extracted items.
 */
function selectExtractedItems<TItem>(
  result: Readonly<IChainExtractionResult<TItem>>,
): readonly TItem[] {
  return result.items;
}

/**
 * Selects warnings from a chain extraction result.
 *
 * @param result - Extraction result.
 * @returns Extraction warnings.
 */
function selectWarnings<TItem>(
  result: Readonly<IChainExtractionResult<TItem>>,
): readonly string[] {
  return result.warnings;
}
