/**
 * Plugin-related shared types
 */

import type { EmitterPluginOptions } from "@/src/emitters/factory";
import type { ParserPluginOptions } from "@/src/parsers/factory";

export interface IPluginOptions {
  /** Emitter plugins to register */
  readonly emitters?: readonly EmitterPluginOptions[];
  /** Parser plugins to register */
  readonly parsers?: readonly ParserPluginOptions[];
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

export type PluginOptions = IPluginOptions;
export type PluginInfo = IPluginInfo;
