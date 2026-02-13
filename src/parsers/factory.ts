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

import { RegistryFactory, type RegistryEntry } from '../core/registry-factory';

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
 * Plugin registration options for parsers.
 */
export interface ParserPluginOptions {
  readonly target: ParserTarget;
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
 * Parser factory implementation extending generic registry factory.
 */
class ParserFactoryImpl extends RegistryFactory<ParserTarget, Parser, ParserMetadata> {
  protected readonly factoryTypeName = 'Parser';
}

/**
 * Singleton parser factory instance with initial registrations.
 */
const parserFactory = new ParserFactoryImpl([
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
  parserFactory.registerPlugin(options);
};

/**
 * Checks if a parser target is registered.
 *
 * @param target - Target to check.
 * @returns True if registered.
 */
export const hasParserPlugin = (target: ParserTarget): boolean => parserFactory.hasPlugin(target);

/**
 * Returns the list of registered parser targets.
 *
 * @param _registry - Registry map to read from (for backward compatibility, ignored).
 * @returns Array of registered parser targets.
 */
export const listParserTargets = (
  _registry?: ReadonlyMap<ParserTarget, RegistryEntry<Parser, ParserMetadata>>,
): ParserTarget[] => parserFactory.listTargets();

/**
 * Gets metadata for a specific parser target.
 *
 * @param target - Parser target to query.
 * @param _registry - Registry map to read from (for backward compatibility, ignored).
 * @returns Metadata for the target.
 */
export const getParserMetadata = (
  target: ParserTarget,
  _registry?: ReadonlyMap<ParserTarget, RegistryEntry<Parser, ParserMetadata>>,
): ParserMetadata => parserFactory.getMetadata(target);

/**
 * Gets metadata for all registered parsers.
 *
 * @param _registry - Registry map to read from (for backward compatibility, ignored).
 * @returns Map of targets to their metadata.
 */
export const getAllParserMetadata = (
  _registry?: ReadonlyMap<ParserTarget, RegistryEntry<Parser, ParserMetadata>>,
): ReadonlyMap<ParserTarget, ParserMetadata> => parserFactory.getAllMetadata();

/**
 * Returns the default parser target.
 *
 * @param _registry - Registry map to read from (for backward compatibility, ignored).
 * @returns The first registered parser target.
 */
export const getDefaultParserTarget = (
  _registry?: ReadonlyMap<ParserTarget, RegistryEntry<Parser, ParserMetadata>>,
): ParserTarget => parserFactory.getDefaultTarget();

/**
 * Creates a parser instance for the requested target.
 *
 * @param target - Parser target to instantiate.
 * @param _registry - Registry map to read from (for backward compatibility, ignored).
 * @returns Parser instance for the target.
 */
export const createParser = (
  target: ParserTarget,
  _registry?: ReadonlyMap<ParserTarget, RegistryEntry<Parser, ParserMetadata>>,
): Parser => parserFactory.createInstance(target);

/**
 * Creates the default parser instance.
 *
 * @param _registry - Registry map to read from (for backward compatibility, ignored).
 * @returns Parser instance for the default target.
 */
export const createDefaultParser = (
  _registry?: ReadonlyMap<ParserTarget, RegistryEntry<Parser, ParserMetadata>>,
): Parser => parserFactory.createDefaultInstance();
