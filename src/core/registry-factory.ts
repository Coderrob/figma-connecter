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
 * Generic Registry Factory Module
 *
 * Provides a reusable base class for registry-based factories.
 * Eliminates code duplication between parser and emitter factories.
 *
 * @module core/registry-factory
 */

/**
 * Registry entry combining factory function and metadata.
 *
 * @template TInstance - The type of instance created by the factory.
 * @template TMetadata - The type of metadata associated with the entry.
 */
export interface RegistryEntry<TInstance, TMetadata> {
  readonly factory: () => TInstance;
  readonly metadata: TMetadata;
}

/**
 * Options for registering a plugin in the registry.
 *
 * @template TTarget - The type of target identifier (enum or string).
 * @template TInstance - The type of instance created by the factory.
 * @template TMetadata - The type of metadata associated with the entry.
 */
export interface PluginOptions<TTarget, TInstance, TMetadata> {
  readonly target: TTarget;
  readonly factory: () => TInstance;
  readonly metadata: TMetadata;
}

/**
 * Generic base class for registry-based factories.
 * Provides common operations for managing a registry of plugins/targets.
 *
 * @template TTarget - The type of target identifier (enum or string).
 * @template TInstance - The type of instance created by the factory.
 * @template TMetadata - The type of metadata associated with the entry.
 */
export abstract class RegistryFactory<TTarget, TInstance, TMetadata> {
  /**
   * Internal registry mapping targets to their entries.
   */
  protected readonly registry: Map<TTarget, RegistryEntry<TInstance, TMetadata>>;

  /**
   * Name of the factory type for error messages (e.g., "Parser", "Emitter").
   */
  protected abstract readonly factoryTypeName: string;

  /**
   * Initializes the registry factory with optional initial entries.
   *
   * @param initialEntries - Optional initial registry entries.
   */
  constructor(initialEntries?: ReadonlyArray<[TTarget, RegistryEntry<TInstance, TMetadata>]>) {
    this.registry = new Map(initialEntries);
  }

  /**
   * Registers a new plugin at runtime.
   *
   * @param options - Plugin configuration.
   * @throws Error if target is already registered.
   */
  registerPlugin(options: PluginOptions<TTarget, TInstance, TMetadata>): void {
    if (this.registry.has(options.target)) {
      throw new Error(
        `${this.factoryTypeName} plugin already registered for target: ${String(options.target)}`,
      );
    }
    this.registry.set(options.target, {
      factory: options.factory,
      metadata: options.metadata,
    });
  }

  /**
   * Checks if a target is registered.
   *
   * @param target - Target to check.
   * @returns True if registered.
   */
  hasPlugin(target: TTarget): boolean {
    return this.registry.has(target);
  }

  /**
   * Returns the list of registered targets.
   *
   * @returns Array of registered targets.
   */
  listTargets(): TTarget[] {
    return [...this.registry.keys()];
  }

  /**
   * Gets metadata for a specific target.
   *
   * @param target - Target to query.
   * @returns Metadata for the target.
   * @throws Error if target is not registered.
   */
  getMetadata(target: TTarget): TMetadata {
    const entry = this.registry.get(target);
    if (!entry) {
      throw new Error(`No ${this.factoryTypeName.toLowerCase()} registered for target: ${String(target)}`);
    }
    return entry.metadata;
  }

  /**
   * Gets metadata for all registered targets.
   *
   * @returns Map of targets to their metadata.
   */
  getAllMetadata(): ReadonlyMap<TTarget, TMetadata> {
    return new Map(Array.from(this.registry, ([target, entry]) => [target, entry.metadata]));
  }

  /**
   * Creates an instance for the requested target.
   *
   * @param target - Target to instantiate.
   * @returns Instance for the target.
   * @throws Error if target is not registered.
   */
  createInstance(target: TTarget): TInstance {
    const entry = this.registry.get(target);
    if (!entry) {
      throw new Error(`No ${this.factoryTypeName.toLowerCase()} registered for target: ${String(target)}`);
    }
    return entry.factory();
  }

  /**
   * Returns the default target (first registered).
   *
   * @returns The first registered target.
   * @throws Error if no targets are registered.
   */
  getDefaultTarget(): TTarget {
    const targets = this.listTargets();
    if (targets.length === 0) {
      throw new Error(`No ${this.factoryTypeName.toLowerCase()} targets registered.`);
    }
    return targets[0];
  }

  /**
   * Creates an instance for the default target.
   *
   * @returns Instance for the default target.
   */
  createDefaultInstance(): TInstance {
    return this.createInstance(this.getDefaultTarget());
  }
}
