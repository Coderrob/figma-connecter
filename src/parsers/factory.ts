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
 * Parser Factory Module
 *
 * Registry-based factory for parser strategies.
 * Uses a metadata-enriched registry to eliminate branching logic.
 *
 * To add a new parser target:
 * 1. Implement the Parser interface
 * 2. Add an entry to PARSER_REGISTRY with metadata
 * 3. No changes needed in pipeline/orchestration code
 *
 * @module parsers/factory
 */

import { type Parser, ParserTarget } from './types';
import { WebComponentParser } from './webcomponent';

/**
 * Metadata describing a parser's capabilities and configuration.
 */
export interface ParserMetadata {
  /** Display name for CLI/logging */
  readonly displayName: string;
  /** Description of what this parser handles */
  readonly description: string;
  /** File patterns this parser can handle (for auto-detection) */
  readonly filePatterns?: readonly string[];
}

/**
 * Registry entry combining factory and metadata.
 */
interface ParserRegistryEntry {
  readonly factory: () => Parser;
  readonly metadata: ParserMetadata;
}

/**
 * Creates a Web Component parser instance.
 *
 * @returns Web Component parser.
 */
const createWebComponentParser = (): Parser => new WebComponentParser();

/**
 * Central registry mapping targets to parser factories and metadata.
 * All parser selection logic flows through this registry.
 * Mutable to support plugin registration.
 */
const PARSER_REGISTRY = new Map<ParserTarget, ParserRegistryEntry>([
  [
    ParserTarget.WebComponent,
    {
      factory: createWebComponentParser,
      metadata: {
        displayName: 'Web Component',
        description: 'Parses LitElement-based Web Components with @property decorators',
        filePatterns: ['*.component.ts', '*.element.ts'],
      },
    },
  ],
]);

/**
 * Plugin registration options for parsers.
 */
export interface ParserPluginOptions {
  readonly target: ParserTarget;
  readonly factory: () => Parser;
  readonly metadata: ParserMetadata;
}

/**
 * Registers a new parser plugin at runtime.
 * Allows external packages to extend parser support without modifying this file.
 *
 * @param options - Plugin configuration.
 * @throws Error if target is already registered.
 *
 * @example
 * ```typescript
 * import { registerParserPlugin } from '@momentum-design/figma-connecter/parsers/factory';
 *
 * registerParserPlugin({
 *   target: ParserTarget.MyCustomTarget,
 *   factory: () => new MyCustomParser(),
 *   metadata: {
 *     displayName: 'My Custom Parser',
 *     description: 'Parses custom component format',
 *     filePatterns: ['*.custom.ts'],
 *   },
 * });
 * ```
 */
export const registerParserPlugin = (options: ParserPluginOptions): void => {
  if (PARSER_REGISTRY.has(options.target)) {
    throw new Error(`Parser plugin already registered for target: ${options.target}`);
  }
  PARSER_REGISTRY.set(options.target, {
    factory: options.factory,
    metadata: options.metadata,
  });
};

/**
 * Checks if a parser target is registered.
 *
 * @param target - Target to check.
 * @returns True if registered.
 */
export const hasParserPlugin = (target: ParserTarget): boolean => PARSER_REGISTRY.has(target);

/**
 * Returns the list of registered parser targets.
 *
 * @param registry - Registry map to read from.
 * @returns Array of registered parser targets.
 */
export const listParserTargets = (
  registry: ReadonlyMap<ParserTarget, ParserRegistryEntry> = PARSER_REGISTRY,
): ParserTarget[] => [...registry.keys()];

/**
 * Gets metadata for a specific parser target.
 *
 * @param target - Parser target to query.
 * @param registry - Registry map to read from.
 * @returns Metadata for the target.
 */
export const getParserMetadata = (
  target: ParserTarget,
  registry: ReadonlyMap<ParserTarget, ParserRegistryEntry> = PARSER_REGISTRY,
): ParserMetadata => {
  const entry = registry.get(target);
  if (!entry) {
    throw new Error(`No parser registered for target: ${target}`);
  }
  return entry.metadata;
};

/**
 * Gets metadata for all registered parsers.
 *
 * @param registry - Registry map to read from.
 * @returns Map of targets to their metadata.
 */
export const getAllParserMetadata = (
  registry: ReadonlyMap<ParserTarget, ParserRegistryEntry> = PARSER_REGISTRY,
): ReadonlyMap<ParserTarget, ParserMetadata> =>
  new Map(Array.from(registry, ([target, entry]) => [target, entry.metadata]));

/**
 * Returns the default parser target.
 *
 * @param registry - Registry map to read from.
 * @returns The first registered parser target.
 */
export const getDefaultParserTarget = (
  registry: ReadonlyMap<ParserTarget, ParserRegistryEntry> = PARSER_REGISTRY,
): ParserTarget => {
  const targets = listParserTargets(registry);
  if (targets.length === 0) {
    throw new Error('No parser targets registered.');
  }
  return targets[0];
};

/**
 * Creates a parser instance for the requested target.
 *
 * @param target - Parser target to instantiate.
 * @param registry - Registry map to read from.
 * @returns Parser instance for the target.
 */
export const createParser = (
  target: ParserTarget,
  registry: ReadonlyMap<ParserTarget, ParserRegistryEntry> = PARSER_REGISTRY,
): Parser => {
  const entry = registry.get(target);
  if (!entry) {
    throw new Error(`No parser registered for target: ${target}`);
  }
  return entry.factory();
};

/**
 * Creates the default parser instance.
 *
 * @param registry - Registry map to read from.
 * @returns Parser instance for the default target.
 */
export const createDefaultParser = (
  registry: ReadonlyMap<ParserTarget, ParserRegistryEntry> = PARSER_REGISTRY,
): Parser => createParser(getDefaultParserTarget(registry), registry);
