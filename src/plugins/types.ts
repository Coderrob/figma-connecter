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
 * Plugin Types
 *
 * Shared plugin registration and introspection contracts.
 *
 * @module plugins/types
 */

import type { IEmitterPluginOptions } from "@/src/emitters/factory";
import type { IParserPluginOptions } from "@/src/parsers/factory";

export interface IPluginOptions {
  /** Emitter plugins to register. */
  readonly emitters?: readonly IEmitterPluginOptions[];
  /** Parser plugins to register. */
  readonly parsers?: readonly IParserPluginOptions[];
}

export interface IPluginInfo {
  readonly emitters: ReadonlyMap<
    string,
    { displayName: string; description: string }
  >;
  readonly parsers: ReadonlyMap<
    string,
    { displayName: string; description: string }
  >;
}

export type PluginInfo = IPluginInfo;
