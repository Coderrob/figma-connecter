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
 * @fileoverview Tests for plugins module.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

import type { Emitter, EmitterContext } from '../src/emitters/types';
import type { Parser, ParseContext } from '../src/parsers/types';
import { EmitterTarget, ParserTarget } from '../src/core/types';
import type { EmitResult, WebComponentParseResult } from '../src/core/types';

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

/**
 * Creates a minimal test parser for plugin registration.
 *
 * @param target - Target identifier for the parser.
 * @returns Test parser instance.
 */
const createTestParser = (target: ParserTarget): Parser => ({
  target,
  parse: (_context: ParseContext): WebComponentParseResult => ({
    model: null,
    warnings: [],
    errors: [],
  }),
});

describe('plugins', () => {
  describe('registerPlugin', () => {
    it('should register emitter plugins', () => {
      jest.isolateModules(() => {
        const plugins = require('../src/plugins') as typeof import('../src/plugins');

        const customTarget = 'custom-emitter' as EmitterTarget;
        plugins.registerPlugin({
          emitters: [
            {
              target: customTarget,
              factory: () => createTestEmitter(customTarget),
              metadata: {
                fileExtension: '.custom.figma.ts',
                displayName: 'Custom Emitter',
                description: 'Custom emitter for tests',
              },
            },
          ],
        });

        expect(plugins.hasEmitterPlugin(customTarget)).toBe(true);
      });
    });

    it('should register parser plugins', () => {
      jest.isolateModules(() => {
        const plugins = require('../src/plugins') as typeof import('../src/plugins');

        const customTarget = 'custom-parser' as ParserTarget;
        plugins.registerPlugin({
          parsers: [
            {
              target: customTarget,
              factory: () => createTestParser(customTarget),
              metadata: {
                displayName: 'Custom Parser',
                description: 'Custom parser for tests',
              },
            },
          ],
        });

        expect(plugins.hasParserPlugin(customTarget)).toBe(true);
      });
    });

    it('should register both emitters and parsers', () => {
      jest.isolateModules(() => {
        const plugins = require('../src/plugins') as typeof import('../src/plugins');

        const emitterTarget = 'custom-emitter-2' as EmitterTarget;
        const parserTarget = 'custom-parser-2' as ParserTarget;

        plugins.registerPlugin({
          emitters: [
            {
              target: emitterTarget,
              factory: () => createTestEmitter(emitterTarget),
              metadata: {
                fileExtension: '.custom2.figma.ts',
                displayName: 'Custom Emitter 2',
                description: 'Custom emitter 2 for tests',
              },
            },
          ],
          parsers: [
            {
              target: parserTarget,
              factory: () => createTestParser(parserTarget),
              metadata: {
                displayName: 'Custom Parser 2',
                description: 'Custom parser 2 for tests',
              },
            },
          ],
        });

        expect(plugins.hasEmitterPlugin(emitterTarget)).toBe(true);
        expect(plugins.hasParserPlugin(parserTarget)).toBe(true);
      });
    });

    it('should handle empty emitters array', () => {
      jest.isolateModules(() => {
        const plugins = require('../src/plugins') as typeof import('../src/plugins');

        expect(() => {
          plugins.registerPlugin({
            emitters: [],
            parsers: [],
          });
        }).not.toThrow();
      });
    });

    it('should handle undefined emitters and parsers', () => {
      jest.isolateModules(() => {
        const plugins = require('../src/plugins') as typeof import('../src/plugins');

        expect(() => {
          plugins.registerPlugin({});
        }).not.toThrow();
      });
    });

    it('should register multiple emitters in a single call', () => {
      jest.isolateModules(() => {
        const plugins = require('../src/plugins') as typeof import('../src/plugins');

        const target1 = 'multi-emitter-1' as EmitterTarget;
        const target2 = 'multi-emitter-2' as EmitterTarget;

        plugins.registerPlugin({
          emitters: [
            {
              target: target1,
              factory: () => createTestEmitter(target1),
              metadata: {
                fileExtension: '.multi1.figma.ts',
                displayName: 'Multi Emitter 1',
                description: 'Multi emitter 1 for tests',
              },
            },
            {
              target: target2,
              factory: () => createTestEmitter(target2),
              metadata: {
                fileExtension: '.multi2.figma.ts',
                displayName: 'Multi Emitter 2',
                description: 'Multi emitter 2 for tests',
              },
            },
          ],
        });

        expect(plugins.hasEmitterPlugin(target1)).toBe(true);
        expect(plugins.hasEmitterPlugin(target2)).toBe(true);
      });
    });

    it('should register multiple parsers in a single call', () => {
      jest.isolateModules(() => {
        const plugins = require('../src/plugins') as typeof import('../src/plugins');

        const target1 = 'multi-parser-1' as ParserTarget;
        const target2 = 'multi-parser-2' as ParserTarget;

        plugins.registerPlugin({
          parsers: [
            {
              target: target1,
              factory: () => createTestParser(target1),
              metadata: {
                displayName: 'Multi Parser 1',
                description: 'Multi parser 1 for tests',
              },
            },
            {
              target: target2,
              factory: () => createTestParser(target2),
              metadata: {
                displayName: 'Multi Parser 2',
                description: 'Multi parser 2 for tests',
              },
            },
          ],
        });

        expect(plugins.hasParserPlugin(target1)).toBe(true);
        expect(plugins.hasParserPlugin(target2)).toBe(true);
      });
    });
  });

  describe('getPluginInfo', () => {
    it('should return plugin information for registered plugins', () => {
      jest.isolateModules(() => {
        const plugins = require('../src/plugins') as typeof import('../src/plugins');

        const emitterTarget = 'info-emitter' as EmitterTarget;
        const parserTarget = 'info-parser' as ParserTarget;

        plugins.registerPlugin({
          emitters: [
            {
              target: emitterTarget,
              factory: () => createTestEmitter(emitterTarget),
              metadata: {
                fileExtension: '.info.figma.ts',
                displayName: 'Info Emitter',
                description: 'Info emitter description',
              },
            },
          ],
          parsers: [
            {
              target: parserTarget,
              factory: () => createTestParser(parserTarget),
              metadata: {
                displayName: 'Info Parser',
                description: 'Info parser description',
              },
            },
          ],
        });

        const info = plugins.getPluginInfo();

        expect(info.emitters.size).toBeGreaterThanOrEqual(1);
        expect(info.parsers.size).toBeGreaterThanOrEqual(1);

        const emitterInfo = info.emitters.get(emitterTarget);
        expect(emitterInfo).toEqual({
          displayName: 'Info Emitter',
          description: 'Info emitter description',
        });

        const parserInfo = info.parsers.get(parserTarget);
        expect(parserInfo).toEqual({
          displayName: 'Info Parser',
          description: 'Info parser description',
        });
      });
    });

    it('should return default plugin information when no custom plugins registered', () => {
      jest.isolateModules(() => {
        const plugins = require('../src/plugins') as typeof import('../src/plugins');

        const info = plugins.getPluginInfo();

        expect(info.emitters.size).toBeGreaterThan(0);
        expect(info.parsers.size).toBeGreaterThan(0);
        expect(info.emitters instanceof Map).toBe(true);
        expect(info.parsers instanceof Map).toBe(true);
      });
    });
  });
});
