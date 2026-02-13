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
 * @fileoverview Tests for generic registry factory base class.
 */

import { RegistryFactory, type PluginOptions, type RegistryEntry } from '../../src/core/registry-factory';

// Test types
enum TestTarget {
  TypeA = 'type-a',
  TypeB = 'type-b',
}

interface TestInstance {
  readonly type: string;
  process(): string;
}

interface TestMetadata {
  readonly displayName: string;
  readonly description: string;
}

// Concrete implementation for testing
class TestFactory extends RegistryFactory<TestTarget, TestInstance, TestMetadata> {
  protected readonly factoryTypeName = 'Test';
}

// Test instance creators
const createTypeAInstance = (): TestInstance => ({
  type: 'A',
  process: () => 'Processing A',
});

const createTypeBInstance = (): TestInstance => ({
  type: 'B',
  process: () => 'Processing B',
});

describe('RegistryFactory', () => {
  describe('constructor', () => {
    it('should initialize with empty registry when no entries provided', () => {
      const factory = new TestFactory();

      expect(factory.listTargets()).toEqual([]);
    });

    it('should initialize with provided entries', () => {
      const entries: Array<[TestTarget, RegistryEntry<TestInstance, TestMetadata>]> = [
        [
          TestTarget.TypeA,
          {
            factory: createTypeAInstance,
            metadata: {
              displayName: 'Type A',
              description: 'Test type A',
            },
          },
        ],
      ];

      const factory = new TestFactory(entries);

      expect(factory.listTargets()).toEqual([TestTarget.TypeA]);
      expect(factory.hasPlugin(TestTarget.TypeA)).toBe(true);
    });
  });

  describe('registerPlugin', () => {
    it('should register a new plugin', () => {
      const factory = new TestFactory();
      const options: PluginOptions<TestTarget, TestInstance, TestMetadata> = {
        target: TestTarget.TypeA,
        factory: createTypeAInstance,
        metadata: {
          displayName: 'Type A',
          description: 'Test type A',
        },
      };

      factory.registerPlugin(options);

      expect(factory.hasPlugin(TestTarget.TypeA)).toBe(true);
      expect(factory.listTargets()).toContain(TestTarget.TypeA);
    });

    it('should throw when registering duplicate target', () => {
      const factory = new TestFactory();
      const options: PluginOptions<TestTarget, TestInstance, TestMetadata> = {
        target: TestTarget.TypeA,
        factory: createTypeAInstance,
        metadata: {
          displayName: 'Type A',
          description: 'Test type A',
        },
      };

      factory.registerPlugin(options);

      expect(() => factory.registerPlugin(options)).toThrow('Test plugin already registered for target: type-a');
    });
  });

  describe('hasPlugin', () => {
    it('should return true for registered target', () => {
      const factory = new TestFactory([
        [
          TestTarget.TypeA,
          {
            factory: createTypeAInstance,
            metadata: { displayName: 'Type A', description: 'Test type A' },
          },
        ],
      ]);

      expect(factory.hasPlugin(TestTarget.TypeA)).toBe(true);
    });

    it('should return false for unregistered target', () => {
      const factory = new TestFactory();

      expect(factory.hasPlugin(TestTarget.TypeA)).toBe(false);
    });
  });

  describe('listTargets', () => {
    it('should return empty array when no targets registered', () => {
      const factory = new TestFactory();

      expect(factory.listTargets()).toEqual([]);
    });

    it('should return all registered targets', () => {
      const factory = new TestFactory([
        [
          TestTarget.TypeA,
          {
            factory: createTypeAInstance,
            metadata: { displayName: 'Type A', description: 'Test type A' },
          },
        ],
        [
          TestTarget.TypeB,
          {
            factory: createTypeBInstance,
            metadata: { displayName: 'Type B', description: 'Test type B' },
          },
        ],
      ]);

      const targets = factory.listTargets();
      expect(targets).toHaveLength(2);
      expect(targets).toContain(TestTarget.TypeA);
      expect(targets).toContain(TestTarget.TypeB);
    });
  });

  describe('getMetadata', () => {
    it('should return metadata for registered target', () => {
      const metadata = { displayName: 'Type A', description: 'Test type A' };
      const factory = new TestFactory([
        [
          TestTarget.TypeA,
          {
            factory: createTypeAInstance,
            metadata,
          },
        ],
      ]);

      expect(factory.getMetadata(TestTarget.TypeA)).toEqual(metadata);
    });

    it('should throw for unregistered target', () => {
      const factory = new TestFactory();

      expect(() => factory.getMetadata(TestTarget.TypeA)).toThrow('No test registered for target: type-a');
    });
  });

  describe('getAllMetadata', () => {
    it('should return metadata map for all targets', () => {
      const metadataA = { displayName: 'Type A', description: 'Test type A' };
      const metadataB = { displayName: 'Type B', description: 'Test type B' };
      const factory = new TestFactory([
        [TestTarget.TypeA, { factory: createTypeAInstance, metadata: metadataA }],
        [TestTarget.TypeB, { factory: createTypeBInstance, metadata: metadataB }],
      ]);

      const allMetadata = factory.getAllMetadata();

      expect(allMetadata.size).toBe(2);
      expect(allMetadata.get(TestTarget.TypeA)).toEqual(metadataA);
      expect(allMetadata.get(TestTarget.TypeB)).toEqual(metadataB);
    });

    it('should return empty map when no targets registered', () => {
      const factory = new TestFactory();

      const allMetadata = factory.getAllMetadata();

      expect(allMetadata.size).toBe(0);
    });
  });

  describe('createInstance', () => {
    it('should create instance for registered target', () => {
      const factory = new TestFactory([
        [
          TestTarget.TypeA,
          {
            factory: createTypeAInstance,
            metadata: { displayName: 'Type A', description: 'Test type A' },
          },
        ],
      ]);

      const instance = factory.createInstance(TestTarget.TypeA);

      expect(instance.type).toBe('A');
      expect(instance.process()).toBe('Processing A');
    });

    it('should throw for unregistered target', () => {
      const factory = new TestFactory();

      expect(() => factory.createInstance(TestTarget.TypeA)).toThrow('No test registered for target: type-a');
    });

    it('should create new instance on each call', () => {
      const factory = new TestFactory([
        [
          TestTarget.TypeA,
          {
            factory: createTypeAInstance,
            metadata: { displayName: 'Type A', description: 'Test type A' },
          },
        ],
      ]);

      const instance1 = factory.createInstance(TestTarget.TypeA);
      const instance2 = factory.createInstance(TestTarget.TypeA);

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('getDefaultTarget', () => {
    it('should return first registered target', () => {
      const factory = new TestFactory([
        [
          TestTarget.TypeA,
          {
            factory: createTypeAInstance,
            metadata: { displayName: 'Type A', description: 'Test type A' },
          },
        ],
        [
          TestTarget.TypeB,
          {
            factory: createTypeBInstance,
            metadata: { displayName: 'Type B', description: 'Test type B' },
          },
        ],
      ]);

      expect(factory.getDefaultTarget()).toBe(TestTarget.TypeA);
    });

    it('should throw when no targets registered', () => {
      const factory = new TestFactory();

      expect(() => factory.getDefaultTarget()).toThrow('No test targets registered.');
    });
  });

  describe('createDefaultInstance', () => {
    it('should create instance for default target', () => {
      const factory = new TestFactory([
        [
          TestTarget.TypeA,
          {
            factory: createTypeAInstance,
            metadata: { displayName: 'Type A', description: 'Test type A' },
          },
        ],
      ]);

      const instance = factory.createDefaultInstance();

      expect(instance.type).toBe('A');
    });

    it('should throw when no targets registered', () => {
      const factory = new TestFactory();

      expect(() => factory.createDefaultInstance()).toThrow('No test targets registered.');
    });
  });
});
