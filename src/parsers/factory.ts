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
 * IParser Factory Module
 *
 * Registry-based factory for parser strategies.
 * Uses a metadata-enriched registry to eliminate branching logic.
 *
 * To add a new parser target:
 * 1. Implement the IParser interface
 * 2. Add an entry to PARSER_REGISTRY with metadata
 * 3. No changes needed in pipeline/orchestration code
 *
 * @module parsers/factory
 */

import { RegistryFactory } from "@/src/core/registry-factory";

import { type IParser, ParserTarget } from "./types";
import { WebComponentParser } from "./webcomponent";

/**
 * Creates the default parser instance for the configured default target.
 * @returns Parser instance for the factory default target.
 */
export function createDefaultParser(): IParser {
  return getParserFactory().createDefaultInstance();
}

/**
 * Metadata describing a parser's capabilities and configuration.
 */
export interface IParserMetadata {
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
export interface IParserPluginOptions {
  readonly target: ParserTarget;
  readonly factory: () => IParser;
  readonly metadata: IParserMetadata;
}

/**
 * Creates a parser instance for the requested target.
 *
 * @param target - IParser target to instantiate.
 * @returns IParser instance for the target.
 */
export function createParser(target: Readonly<ParserTarget>): IParser {
  return getParserFactory().createInstance(target);
}

/**
 * IParser factory implementation extending generic registry factory.
 */
class ParserFactoryImpl extends RegistryFactory<
  ParserTarget,
  IParser,
  IParserMetadata
> {
  protected readonly factoryTypeName = "IParser";
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
        displayName: "Web Component",
        description:
          "Parses LitElement-based Web Components with @property decorators",
        filePatterns: ["*.component.ts", "*.element.ts"],
      },
    },
  ],
]);

/**
 * Creates the built-in Web Component parser instance.
 * @returns Web Component parser implementation.
 */
function createWebComponentParser(): IParser {
  return new WebComponentParser();
}

/**
 * Returns metadata for all registered parser targets.
 * @returns Read-only map of parser targets to metadata.
 */
export const getAllParserMetadata = (): ReadonlyMap<
  ParserTarget,
  IParserMetadata
> => parserFactory.getAllMetadata();

/**
 * Returns the default parser target configured by the factory.
 * @returns Default parser target.
 */
export const getDefaultParserTarget = (): ParserTarget =>
  parserFactory.getDefaultTarget();

/**
 * Returns the singleton parser factory instance.
 * @returns Shared parser factory used by the module.
 */
function getParserFactory(): ParserFactoryImpl {
  return parserFactory;
}

/**
 * Returns metadata for a specific parser target.
 * @param target - Parser target to inspect.
 * @returns Metadata registered for the target.
 */
export const getParserMetadata = (target: Readonly<ParserTarget>): IParserMetadata =>
  parserFactory.getMetadata(target);

/**
 * Returns true when a parser plugin is registered for a target.
 * @param target - Parser target to inspect.
 * @returns True when the target has a registered parser plugin.
 */
export const hasParserPlugin = (target: Readonly<ParserTarget>): boolean =>
  parserFactory.hasPlugin(target);

/**
 * Lists all registered parser targets.
 * @returns Registered parser targets in factory order.
 */
export const listParserTargets = (): ParserTarget[] =>
  parserFactory.listTargets();

/**
 * Registers a parser plugin with the shared factory.
 * @param options - Plugin factory and metadata registration payload.
 * @returns Nothing.
 */
export const registerParserPlugin = (options: Readonly<IParserPluginOptions>): void => {
  parserFactory.registerPlugin(options);
};
