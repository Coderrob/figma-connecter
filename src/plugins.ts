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
 * Plugin API Module
 *
 * Centralized plugin registration interface for extending the tool
 * with custom emitters and parsers without modifying core code.
 *
 * @module plugins
 */

import {
  getAllEmitterMetadata,
  getAllParserMetadata,
  registerEmitterPlugin as registerEmitterPluginImpl,
  registerParserPlugin as registerParserPluginImpl,
} from './internal-plugin-registry';

// Re-export plugin interfaces and functions
export {
  type EmitterPluginOptions,
  hasEmitterPlugin,
  listEmitterTargets,
  registerEmitterPlugin,
} from './emitters/factory';
export { hasParserPlugin, listParserTargets, type ParserPluginOptions, registerParserPlugin } from './parsers/factory';

/**
 * Unified plugin registration options.
 * Allows registering multiple emitters and parsers in a single call.
 */
export interface PluginOptions {
  /** Emitter plugins to register */
  readonly emitters?: readonly import('./emitters/factory').EmitterPluginOptions[];
  /** Parser plugins to register */
  readonly parsers?: readonly import('./parsers/factory').ParserPluginOptions[];
}

/**
 * Registers one or more plugins in a single call.
 * Provides a convenient interface for plugin packages that bundle
 * both emitters and parsers.
 *
 * @param options - Plugin configuration.
 * @throws Error if any target is already registered.
 */
export const registerPlugin = (options: PluginOptions): void => {
  if (options.emitters) {
    for (const emitter of options.emitters) {
      registerEmitterPluginImpl(emitter);
    }
  }

  if (options.parsers) {
    for (const parser of options.parsers) {
      registerParserPluginImpl(parser);
    }
  }
};

/**
 * Plugin information for display purposes.
 */
export interface PluginInfo {
  readonly emitters: ReadonlyMap<string, { displayName: string; description: string }>;
  readonly parsers: ReadonlyMap<string, { displayName: string; description: string }>;
}

/**
 * Gets information about all registered plugins.
 * Useful for debugging and displaying available extensions.
 *
 * @returns Plugin information.
 */
export const getPluginInfo = (): PluginInfo => {
  const emitterMetadata = getAllEmitterMetadata();
  const parserMetadata = getAllParserMetadata();

  return {
    emitters: new Map(
      Array.from(emitterMetadata, ([target, meta]) => [
        target,
        { displayName: meta.displayName, description: meta.description },
      ]),
    ),
    parsers: new Map(
      Array.from(parserMetadata, ([target, meta]) => [
        target,
        { displayName: meta.displayName, description: meta.description },
      ]),
    ),
  };
};
