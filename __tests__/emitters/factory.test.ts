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
 * @fileoverview Tests for emitter factory module.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

import { EmitterTarget } from '../../src/core/types';
import type { EmitResult } from '../../src/core/types';
import { createEmitter, createEmitters, listEmitterTargets } from '../../src/emitters/factory';
import { FigmaReactEmitter } from '../../src/emitters/figma-react';
import { FigmaWebComponentEmitter } from '../../src/emitters/figma-webcomponent';
import type { Emitter, EmitterContext } from '../../src/emitters/types';

/**
 * Creates a minimal test emitter for plugin registration.
 *
 * @param target - Target identifier for the emitter.
 * @returns Test emitter instance.
 */
const createTestEmitter = (target: EmitterTarget): Emitter => ({
  target,
  emit: (_context: EmitterContext): EmitResult => ({
    filePath: `/${target}.figma.ts`,
    content: '',
    action: 'created',
  }),
});

describe('createEmitters', () => {
  describe('positive cases', () => {
    it('should create WebComponent emitter when target is webcomponent', () => {
      const emitters = createEmitters({ targets: [EmitterTarget.WebComponent] });

      expect(emitters).toHaveLength(1);
      expect(emitters[0]).toBeInstanceOf(FigmaWebComponentEmitter);
    });

    it('should create React emitter when target is react', () => {
      const emitters = createEmitters({ targets: [EmitterTarget.React] });

      expect(emitters).toHaveLength(1);
      expect(emitters[0]).toBeInstanceOf(FigmaReactEmitter);
    });

    it('should create both emitters when both targets are specified', () => {
      const emitters = createEmitters({
        targets: [EmitterTarget.WebComponent, EmitterTarget.React],
      });

      expect(emitters).toHaveLength(2);
      expect(emitters[0]).toBeInstanceOf(FigmaWebComponentEmitter);
      expect(emitters[1]).toBeInstanceOf(FigmaReactEmitter);
    });

    it('should create a single emitter via createEmitter', () => {
      const emitter = createEmitter(EmitterTarget.WebComponent);

      expect(emitter).toBeInstanceOf(FigmaWebComponentEmitter);
    });
  });

  describe('negative cases', () => {
    it('should return empty array when no targets specified', () => {
      const emitters = createEmitters({ targets: [] });

      expect(emitters).toEqual([]);
    });

    it('should throw when an unknown target is requested', () => {
      expect(() => createEmitter('unknown' as EmitterTarget)).toThrow('No emitter registered for target: unknown');
    });
  });

  describe('edge cases', () => {
    it('should do not create duplicate emitters for repeated targets', () => {
      const emitters = createEmitters({
        targets: [EmitterTarget.WebComponent, EmitterTarget.WebComponent],
      });

      expect(emitters).toHaveLength(1);
      expect(emitters[0]).toBeInstanceOf(FigmaWebComponentEmitter);
    });

    it('should preserve order: WebComponent before React', () => {
      const emitters = createEmitters({
        targets: [EmitterTarget.React, EmitterTarget.WebComponent],
      });

      expect(emitters).toHaveLength(2);
      expect(emitters[0]).toBeInstanceOf(FigmaWebComponentEmitter);
      expect(emitters[1]).toBeInstanceOf(FigmaReactEmitter);
    });
  });
});
describe('listEmitterTargets', () => {
  it('should include all emitter targets', () => {
    expect(listEmitterTargets()).toEqual([EmitterTarget.WebComponent, EmitterTarget.React]);
  });
});

describe('emitter registry helpers', () => {
  it('should register a plugin and expose metadata', () => {
    jest.isolateModules(() => {
      const factory = require('../../src/emitters/factory') as typeof import('../../src/emitters/factory');

      const customTarget = 'custom' as EmitterTarget;
      const metadata = {
        fileExtension: '.custom.figma.ts',
        displayName: 'Custom',
        description: 'Custom emitter for tests',
      };

      factory.registerEmitterPlugin({
        target: customTarget,
        factory: () => createTestEmitter(customTarget),
        metadata,
      });

      expect(factory.hasEmitterPlugin(customTarget)).toBe(true);
      expect(factory.getEmitterMetadata(customTarget)).toEqual(metadata);

      const allMetadata = factory.getAllEmitterMetadata();
      expect(allMetadata.get(customTarget)).toEqual(metadata);
    });
  });

  it('should throw when registering an existing target', () => {
    jest.isolateModules(() => {
      const factory = require('../../src/emitters/factory') as typeof import('../../src/emitters/factory');

      expect(() =>
        factory.registerEmitterPlugin({
          target: EmitterTarget.WebComponent,
          factory: () => createTestEmitter(EmitterTarget.WebComponent),
          metadata: {
            fileExtension: '.duplicate.figma.ts',
            displayName: 'Duplicate',
            description: 'Duplicate emitter for tests',
          },
        }),
      ).toThrow('Emitter plugin already registered for target: webcomponent');
    });
  });

  it('should throw when requesting metadata for an unknown target', () => {
    jest.isolateModules(() => {
      const factory = require('../../src/emitters/factory') as typeof import('../../src/emitters/factory');

      expect(() => factory.getEmitterMetadata('unknown' as EmitterTarget)).toThrow(
        'No emitter registered for target: unknown',
      );
    });
  });
});
