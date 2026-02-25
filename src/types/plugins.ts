/**
 * Plugin-related shared types
 */

export interface PluginOptions {
  /** Emitter plugins to register */
  readonly emitters?: readonly import("../emitters/factory").EmitterPluginOptions[];
  /** Parser plugins to register */
  readonly parsers?: readonly import("../parsers/factory").ParserPluginOptions[];
}

export interface PluginInfo {
  readonly emitters: ReadonlyMap<
    string,
    { displayName: string; description: string }
  >;
  readonly parsers: ReadonlyMap<
    string,
    { displayName: string; description: string }
  >;
}
