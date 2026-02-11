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

import {
  createDefaultParser,
  createParser,
  getDefaultParserTarget,
  listParserTargets,
} from '../../src/parsers/factory';
import { ParserTarget } from '../../src/parsers/types';

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
