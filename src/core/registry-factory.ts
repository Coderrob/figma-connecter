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

import assert from "node:assert/strict";

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
export interface IRegistryEntry<TInstance, TMetadata> {
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
export interface IPluginOptions<TTarget, TInstance, TMetadata> {
  readonly target: TTarget;
  readonly factory: () => TInstance;
  readonly metadata: TMetadata;
}

type RegistryEntries<TTarget, TInstance, TMetadata> = ReadonlyArray<
  readonly [TTarget, IRegistryEntry<TInstance, TMetadata>]
>;

let registryEntriesStore = new Map<object, readonly unknown[]>();

/**
 * Formats a target identifier for error messages.
 *
 * @template TTarget - The type of target identifier.
 * @param target - Target identifier to format.
 * @returns String representation safe for diagnostics.
 */
function formatTargetIdentifier(target: unknown): string {
  if (
    typeof target === "string" ||
    typeof target === "number" ||
    typeof target === "boolean" ||
    typeof target === "bigint" ||
    typeof target === "symbol"
  ) {
    return String(target);
  }

  if (target === null || target === undefined) {
    return String(target);
  }

  return JSON.stringify(target);
}

/**
 * Extracts the target identifier from a registry entry tuple.
 *
 * @template TTarget - The type of target identifier.
 * @template TInstance - The type of instance created by the factory.
 * @template TMetadata - The type of metadata associated with the entry.
 * @param entry - Registry entry tuple.
 * @returns Target identifier for the entry.
 */
function getEntryTarget<TTarget, TInstance, TMetadata>(
  entry: Readonly<readonly [TTarget, IRegistryEntry<TInstance, TMetadata>]>,
): TTarget {
  return entry[0];
}

/**
 * Normalizes factory names for lower-case error messages.
 *
 * @param factoryTypeName - Display name used by the factory.
 * @returns Lower-case factory label suitable for error messages.
 */
function getFactoryLabel(factoryTypeName: string): string {
  if (factoryTypeName.startsWith("I") && factoryTypeName.length > 1) {
    return factoryTypeName.slice(1).toLowerCase();
  }
  return factoryTypeName.toLowerCase();
}

/**
 * Returns stored registry entries for a factory instance.
 *
 * @param factory - Factory instance used as the storage key.
 * @returns Stored registry entries.
 */
function getStoredRegistryEntries<TTarget, TInstance, TMetadata>(
  factory: object,
): RegistryEntries<TTarget, TInstance, TMetadata> {
  const stored = registryEntriesStore.get(factory);
  return isRegistryEntryArray<TTarget, TInstance, TMetadata>(stored)
    ? stored
    : [];
}

/**
 * Narrows a stored value to typed registry entries.
 *
 * @template TTarget - Target identifier type.
 * @template TInstance - Instance type.
 * @template TMetadata - Metadata type.
 * @param value - Value from the store.
 * @returns True when value is a registry entries array.
 */
function isRegistryEntryArray<TTarget, TInstance, TMetadata>(
  value: readonly unknown[] | undefined,
): value is RegistryEntries<TTarget, TInstance, TMetadata> {
  return value !== undefined;
}

/**
 * Stores registry entries for a factory instance.
 *
 * @param factory - Factory instance used as the storage key.
 * @param entries - Registry entries to store.
 * @returns Nothing.
 */
function setStoredRegistryEntries<TTarget, TInstance, TMetadata>(
  factory: object,
  entries: Readonly<RegistryEntries<TTarget, TInstance, TMetadata>>,
): void {
  registryEntriesStore = new Map([...registryEntriesStore, [factory, entries]]);
}

/**
 * Converts a registry entry tuple into a metadata tuple.
 *
 * @template TTarget - The type of target identifier.
 * @template TInstance - The type of instance created by the factory.
 * @template TMetadata - The type of metadata associated with the entry.
 * @param entry - Registry entry tuple.
 * @returns Target and metadata tuple.
 */
function toMetadataEntry<TTarget, TInstance, TMetadata>(
  entry: Readonly<readonly [TTarget, IRegistryEntry<TInstance, TMetadata>]>,
): readonly [TTarget, TMetadata] {
  const [target, registryEntry] = entry;
  return [target, registryEntry.metadata];
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
   * Name of the factory type for error messages (e.g., "IParser", "IEmitter").
   */
  protected abstract readonly factoryTypeName: string;

  /**
   * Initializes the registry factory with optional initial entries.
   *
   * @param entries - Optional initial registry entries.
   */
  constructor(
    entries: Readonly<RegistryEntries<TTarget, TInstance, TMetadata>> = [],
  ) {
    setStoredRegistryEntries(this, entries);
  }

  /**
   * Returns registry entries for the current factory instance.
   *
   * @returns Registry entries in registration order.
   */
  protected get entries(): RegistryEntries<TTarget, TInstance, TMetadata> {
    return getStoredRegistryEntries<TTarget, TInstance, TMetadata>(this);
  }

  /**
   * Registers a new plugin at runtime.
   *
   * @param options - Plugin configuration.
   * @throws Error if target is already registered.
   */
  registerPlugin(
    options: Readonly<IPluginOptions<TTarget, TInstance, TMetadata>>,
  ): void {
    const registry = new Map(this.entries);
    assert(
      !registry.has(options.target),
      `${this.factoryTypeName} plugin already registered for target: ${formatTargetIdentifier(options.target)}`,
    );

    setStoredRegistryEntries(this, [
      ...this.entries,
      [
        options.target,
        {
          factory: options.factory,
          metadata: options.metadata,
        },
      ],
    ]);
  }

  /**
   * Checks if a target is registered.
   *
   * @param target - Target to check.
   * @returns True if registered.
   */
  hasPlugin(target: Readonly<TTarget>): boolean {
    return new Map(this.entries).has(target);
  }

  /**
   * Returns the list of registered targets.
   *
   * @returns Array of registered targets.
   */
  listTargets(): TTarget[] {
    return this.entries.map(getEntryTarget);
  }

  /**
   * Gets metadata for a specific target.
   *
   * @param target - Target to query.
   * @returns Metadata for the target.
   * @throws Error if target is not registered.
   */
  getMetadata(target: Readonly<TTarget>): TMetadata {
    const entry = new Map(this.entries).get(target);
    assert(
      entry,
      `No ${getFactoryLabel(this.factoryTypeName)} registered for target: ${formatTargetIdentifier(target)}`,
    );
    return entry.metadata;
  }

  /**
   * Gets metadata for all registered targets.
   *
   * @returns Map of targets to their metadata.
   */
  getAllMetadata(): ReadonlyMap<TTarget, TMetadata> {
    return new Map<TTarget, TMetadata>(this.entries.map(toMetadataEntry));
  }

  /**
   * Creates an instance for the requested target.
   *
   * @param target - Target to instantiate.
   * @returns Instance for the target.
   * @throws Error if target is not registered.
   */
  createInstance(target: Readonly<TTarget>): TInstance {
    const entry = new Map(this.entries).get(target);
    assert(
      entry,
      `No ${getFactoryLabel(this.factoryTypeName)} registered for target: ${formatTargetIdentifier(target)}`,
    );
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
    assert(
      targets.length > 0,
      `No ${getFactoryLabel(this.factoryTypeName)} targets registered.`,
    );
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
