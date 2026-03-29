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
 * Centralized plugin registration and inspection helpers for extending the tool
 * with custom emitters and parsers.
 *
 * @module plugins/api
 */

import {
  getAllEmitterMetadata,
  getAllParserMetadata,
  registerEmitterPlugin as registerEmitterPluginImpl,
  registerParserPlugin as registerParserPluginImpl,
} from "./internal-registry";
import type { IPluginInfo, IPluginOptions } from "./types";

type PluginInfoEntry = readonly [
  string,
  { readonly displayName: string; readonly description: string },
];

type PluginInfoTuple = [string, { displayName: string; description: string }];

/**
 * Gets information about all registered plugins.
 * Useful for debugging and displaying available extensions.
 *
 * @returns Plugin information.
 */
export function getPluginInfo(): IPluginInfo {
  const emitterMetadata = getAllEmitterMetadata();
  const parserMetadata = getAllParserMetadata();
  const emitters = new Map<
    string,
    { displayName: string; description: string }
  >(Array.from(emitterMetadata, mapPluginMetadataEntry));
  const parsers = new Map<string, { displayName: string; description: string }>(
    Array.from(parserMetadata, mapPluginMetadataEntry),
  );

  return {
    emitters,
    parsers,
  };
}

/**
 * Registers one or more plugins in a single call.
 * Provides a convenient interface for plugin packages that bundle
 * both emitters and parsers.
 *
 * @param options - Plugin configuration.
 * @throws Error if any target is already registered.
 */
export function registerPlugin(options: Readonly<IPluginOptions>): void {
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
}

/**
 * Builds a normalized plugin info tuple from plugin metadata.
 *
 * @param entry - Plugin metadata map entry.
 * @returns Key/value tuple for plugin info map construction.
 */
function mapPluginMetadataEntry(entry: PluginInfoEntry): PluginInfoTuple {
  const [target, meta] = entry;
  return [
    target,
    {
      displayName: meta.displayName,
      description: meta.description,
    },
  ];
}
