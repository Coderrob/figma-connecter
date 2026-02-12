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
 * @fileoverview Tests for parser factory module.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

import {
  createDefaultParser,
  createParser,
  getDefaultParserTarget,
  getAllParserMetadata,
  getParserMetadata,
  hasParserPlugin,
  listParserTargets,
} from '../../src/parsers/factory';
import { ParserTarget, type Parser, type ParseContext } from '../../src/parsers/types';
import type { WebComponentParseResult } from '../../src/core/types';

describe('createParser', () => {
  it('should return the webcomponent parser', () => {
    const parser = createParser(ParserTarget.WebComponent);

    expect(typeof parser.parse).toBe('function');
  });

  it('should throw for unsupported parser targets', () => {
    expect(() => createParser('unknown' as ParserTarget)).toThrow('No parser registered for target: unknown');
  });
});

describe('createDefaultParser', () => {
  it('should return the default parser instance', () => {
    const parser = createDefaultParser();

    expect(typeof parser.parse).toBe('function');
  });
});

describe('getDefaultParserTarget', () => {
  it('should return the first registered parser target', () => {
    expect(getDefaultParserTarget()).toBe(ParserTarget.WebComponent);
  });

  it('should throw when no parser targets are registered', () => {
    expect(() => getDefaultParserTarget(new Map())).toThrow('No parser targets registered.');
  });
});

describe('listParserTargets', () => {
  it('should include all parser targets', () => {
    expect(listParserTargets()).toEqual([ParserTarget.WebComponent]);
  });
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

describe('parser registry helpers', () => {
  describe('registerParserPlugin', () => {
    it('should register a plugin and expose metadata', () => {
      jest.isolateModules(() => {
        const factory = require('../../src/parsers/factory') as typeof import('../../src/parsers/factory');

        const customTarget = 'custom' as ParserTarget;
        const metadata = {
          displayName: 'Custom',
          description: 'Custom parser for tests',
        };

        factory.registerParserPlugin({
          target: customTarget,
          factory: () => createTestParser(customTarget),
          metadata,
        });

        expect(factory.hasParserPlugin(customTarget)).toBe(true);
        expect(factory.getParserMetadata(customTarget)).toEqual(metadata);

        const allMetadata = factory.getAllParserMetadata();
        expect(allMetadata.get(customTarget)).toEqual(metadata);
      });
    });

    it('should throw when registering an existing target', () => {
      jest.isolateModules(() => {
        const factory = require('../../src/parsers/factory') as typeof import('../../src/parsers/factory');

        expect(() =>
          factory.registerParserPlugin({
            target: ParserTarget.WebComponent,
            factory: () => createTestParser(ParserTarget.WebComponent),
            metadata: {
              displayName: 'Duplicate',
              description: 'Duplicate parser for tests',
            },
          }),
        ).toThrow('Parser plugin already registered for target: webcomponent');
      });
    });
  });

  describe('hasParserPlugin', () => {
    it('should return true for registered parser targets', () => {
      expect(hasParserPlugin(ParserTarget.WebComponent)).toBe(true);
    });

    it('should return false for unregistered parser targets', () => {
      expect(hasParserPlugin('unknown' as ParserTarget)).toBe(false);
    });
  });

  describe('getParserMetadata', () => {
    it('should return metadata for registered parsers', () => {
      const metadata = getParserMetadata(ParserTarget.WebComponent);

      expect(metadata.displayName).toBe('Web Component');
      expect(metadata.description).toBeTruthy();
    });

    it('should throw when requesting metadata for an unknown target', () => {
      expect(() => getParserMetadata('unknown' as ParserTarget)).toThrow(
        'No parser registered for target: unknown',
      );
    });
  });

  describe('getAllParserMetadata', () => {
    it('should return metadata for all registered parsers', () => {
      const allMetadata = getAllParserMetadata();

      expect(allMetadata.size).toBeGreaterThan(0);
      expect(allMetadata.has(ParserTarget.WebComponent)).toBe(true);
      expect(allMetadata instanceof Map).toBe(true);
    });
  });
});
