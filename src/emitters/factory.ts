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
 * IEmitter Factory Module
 *
 * Registry-based factory for emitter strategies.
 * Uses a metadata-enriched registry to eliminate branching logic.
 *
 * To add a new emitter target:
 * 1. Implement the IEmitter interface
 * 2. Add an entry to EMITTER_REGISTRY with metadata
 * 3. No changes needed in pipeline/orchestration code
 *
 * @module emitters/factory
 */

import { RegistryFactory } from "@/src/core/registry-factory";
import { EmitterTarget } from "@/src/core/types";

import { FigmaReactEmitter } from "./figma-react";
import { FigmaWebComponentEmitter } from "./figma-webcomponent";
import type { IEmitter } from "./types";

/**
 * Creates an emitter instance for a specific target.
 * @param target - Emitter target to instantiate.
 * @returns Emitter instance registered for the target.
 */
export function createEmitter(target: Readonly<EmitterTarget>): IEmitter {
  return getEmitterFactory().createInstance(target);
}

/**
 * Creates emitter instances for the requested target set.
 * @param options - Emitter selection options.
 * @returns Emitters ordered by registry registration order.
 */
export function createEmitters(
  options: Readonly<IEmitterFactoryOptions>,
): IEmitter[] {
  const targets = new Set(options.targets);
  const allTargets = getEmitterFactory().listTargets();
  const hasTarget = targets.has.bind(targets);

  // Iterate in registry order to ensure consistent output
  return allTargets.filter(hasTarget).map(createEmitter);
}

/**
 * Options for selecting emitter targets from the registry.
 */
export interface IEmitterFactoryOptions {
  readonly targets: readonly EmitterTarget[];
}

/**
 * Metadata describing an emitter's capabilities and configuration.
 */
export interface IEmitterMetadata {
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
export interface IEmitterPluginOptions {
  readonly target: EmitterTarget;
  readonly factory: () => IEmitter;
  readonly metadata: IEmitterMetadata;
}

/**
 * Creates the built-in React emitter instance.
 * @returns React emitter implementation.
 */
function createReactEmitter(): IEmitter {
  return new FigmaReactEmitter();
}

/**
 * Creates the built-in Web Component emitter instance.
 * @returns Web Component emitter implementation.
 */
function createWebComponentEmitter(): IEmitter {
  return new FigmaWebComponentEmitter();
}

/**
 * IEmitter factory implementation extending generic registry factory.
 */
class EmitterFactoryImpl extends RegistryFactory<
  EmitterTarget,
  IEmitter,
  IEmitterMetadata
> {
  protected readonly factoryTypeName = "IEmitter";
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
        fileExtension: ".webcomponent.figma.ts",
        displayName: "Web Component",
        description: "Figma Code Connect for HTML/Web Components",
      },
    },
  ],
  [
    EmitterTarget.React,
    {
      factory: createReactEmitter,
      metadata: {
        fileExtension: ".react.figma.tsx",
        displayName: "React",
        description: "Figma Code Connect for React components",
      },
    },
  ],
]);

/**
 * Returns metadata for all registered emitter targets.
 * @returns Read-only map of emitter targets to metadata.
 */
export const getAllEmitterMetadata = (): ReadonlyMap<
  EmitterTarget,
  IEmitterMetadata
> => emitterFactory.getAllMetadata();

/**
 * Returns the singleton emitter factory instance.
 * @returns Shared emitter factory used by the module.
 */
function getEmitterFactory(): EmitterFactoryImpl {
  return emitterFactory;
}

/**
 * Returns metadata for a specific emitter target.
 * @param target - Emitter target to inspect.
 * @returns Metadata registered for the target.
 */
export const getEmitterMetadata = (
  target: Readonly<EmitterTarget>,
): IEmitterMetadata => emitterFactory.getMetadata(target);

/**
 * Returns true when an emitter plugin is registered for a target.
 * @param target - Emitter target to inspect.
 * @returns True when the target has a registered emitter plugin.
 */
export const hasEmitterPlugin = (target: Readonly<EmitterTarget>): boolean =>
  emitterFactory.hasPlugin(target);

/**
 * Lists all registered emitter targets.
 * @returns Registered emitter targets in factory order.
 */
export const listEmitterTargets = (): EmitterTarget[] =>
  emitterFactory.listTargets();

/**
 * Registers an emitter plugin with the shared factory.
 * @param options - Plugin factory and metadata registration payload.
 * @returns Nothing.
 */
export const registerEmitterPlugin = (
  options: Readonly<IEmitterPluginOptions>,
): void => {
  emitterFactory.registerPlugin(options);
};
