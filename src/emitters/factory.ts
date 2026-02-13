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
 * Emitter Factory Module
 *
 * Registry-based factory for emitter strategies.
 * Uses a metadata-enriched registry to eliminate branching logic.
 *
 * To add a new emitter target:
 * 1. Implement the Emitter interface
 * 2. Add an entry to EMITTER_REGISTRY with metadata
 * 3. No changes needed in pipeline/orchestration code
 *
 * @module emitters/factory
 */

import { EmitterTarget } from '../core/types';
import { RegistryFactory } from '../core/registry-factory';

import { FigmaReactEmitter } from './figma-react';
import { FigmaWebComponentEmitter } from './figma-webcomponent';
import type { Emitter } from './types';

/**
 * Options for selecting emitter targets from the registry.
 */
export interface EmitterFactoryOptions {
  readonly targets: readonly EmitterTarget[];
}

/**
 * Metadata describing an emitter's capabilities and configuration.
 */
export interface EmitterMetadata {
  /** File extension for emitted files (e.g., '.figma.ts' or '.figma.tsx') */
  readonly fileExtension: string;
  /** Display name for CLI/logging */
  readonly displayName: string;
  /** Description of what this emitter generates */
  readonly description: string;
}

/**
 * Plugin registration options for emitters.
 */
export interface EmitterPluginOptions {
  readonly target: EmitterTarget;
  readonly factory: () => Emitter;
  readonly metadata: EmitterMetadata;
}

/**
 * Creates a Web Component emitter instance.
 *
 * @returns Web Component emitter.
 */
const createWebComponentEmitter = (): Emitter => new FigmaWebComponentEmitter();

/**
 * Creates a React emitter instance.
 *
 * @returns React emitter.
 */
const createReactEmitter = (): Emitter => new FigmaReactEmitter();

/**
 * Emitter factory implementation extending generic registry factory.
 */
class EmitterFactoryImpl extends RegistryFactory<EmitterTarget, Emitter, EmitterMetadata> {
  protected readonly factoryTypeName = 'Emitter';
}

/**
 * Singleton emitter factory instance with initial registrations.
 */
const emitterFactory = new EmitterFactoryImpl([
  [
    EmitterTarget.WebComponent,
    {
      factory: createWebComponentEmitter,
      metadata: {
        fileExtension: '.webcomponent.figma.ts',
        displayName: 'Web Component',
        description: 'Figma Code Connect for HTML/Web Components',
      },
    },
  ],
  [
    EmitterTarget.React,
    {
      factory: createReactEmitter,
      metadata: {
        fileExtension: '.react.figma.tsx',
        displayName: 'React',
        description: 'Figma Code Connect for React components',
      },
    },
  ],
]);

/**
 * Registers a new emitter plugin at runtime.
 * Allows external packages to extend emitter support without modifying this file.
 *
 * @param options - Plugin configuration.
 * @throws Error if target is already registered.
 *
 * @example
 * ```typescript
 * import { registerEmitterPlugin } from '@momentum-design/figma-connecter/emitters/factory';
 *
 * registerEmitterPlugin({
 *   target: EmitterTarget.MyCustomTarget,
 *   factory: () => new MyCustomEmitter(),
 *   metadata: {
 *     fileExtension: '.custom.figma.ts',
 *     displayName: 'My Custom Target',
 *     description: 'Custom emitter for specialized components',
 *   },
 * });
 * ```
 */
export const registerEmitterPlugin = (options: EmitterPluginOptions): void => {
  emitterFactory.registerPlugin(options);
};

/**
 * Checks if an emitter target is registered.
 *
 * @param target - Target to check.
 * @returns True if registered.
 */
export const hasEmitterPlugin = (target: EmitterTarget): boolean => emitterFactory.hasPlugin(target);

/**
 * Returns the list of registered emitter targets.
 *
 * @returns Array of registered emitter targets.
 */
export const listEmitterTargets = (): EmitterTarget[] => emitterFactory.listTargets();

/**
 * Gets metadata for a specific emitter target.
 *
 * @param target - Emitter target to query.
 * @returns Metadata for the target.
 */
export const getEmitterMetadata = (target: EmitterTarget): EmitterMetadata => emitterFactory.getMetadata(target);

/**
 * Gets metadata for all registered emitters.
 *
 * @returns Map of targets to their metadata.
 */
export const getAllEmitterMetadata = (): ReadonlyMap<EmitterTarget, EmitterMetadata> =>
  emitterFactory.getAllMetadata();

/**
 * Creates a single emitter instance for the requested target.
 *
 * @param target - Emitter target to instantiate.
 * @returns Emitter instance for the target.
 */
export const createEmitter = (target: EmitterTarget): Emitter => emitterFactory.createInstance(target);

/**
 * Creates emitter instances for the requested targets.
 * Uses only targets that exist in the registry (silently skips unknown targets).
 *
 * @param options - Factory options including target list.
 * @returns Array of emitter instances in registry order.
 */
export const createEmitters = (options: EmitterFactoryOptions): Emitter[] => {
  const targets = new Set(options.targets);
  const allTargets = emitterFactory.listTargets();

  // Iterate in registry order to ensure consistent output
  return allTargets.filter((target) => targets.has(target)).map((target) => emitterFactory.createInstance(target));
};
