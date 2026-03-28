/**
 * Plugin-related shared types
 */

import type { IEmitterPluginOptions } from "@/src/emitters/factory";
import type { IParserPluginOptions } from "@/src/parsers/factory";

export interface IPluginOptions {
  /** IEmitter plugins to register */
  readonly emitters?: readonly IEmitterPluginOptions[];
  /** IParser plugins to register */
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
