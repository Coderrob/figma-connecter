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
 * @fileoverview Tests for emitter utilities.
 */

import {
  buildPropsSection,
  formatPropAccessor,
  GENERATED_SECTION_MARKERS,
  getComponentBaseName,
  wrapGeneratedSection,
} from '../../src/emitters/utils';
import { createMockComponentModel } from '../helpers/fixtures';

describe('getComponentBaseName', () => {
  it('should return file-based component name when pattern matches', () => {
    const model = createMockComponentModel({
      filePath: '/tmp/button.component.ts',
      componentDir: '/tmp/button',
    });

    expect(getComponentBaseName(model)).toBe('button');
  });

  it('should fall back to directory name when pattern does not match', () => {
    const model = createMockComponentModel({
      filePath: '/tmp/button.ts',
      componentDir: '/tmp/button',
    });

    expect(getComponentBaseName(model)).toBe('button');
  });
});

describe('formatPropAccessor', () => {
  it('should use dot access for valid identifiers', () => {
    expect(formatPropAccessor('disabled')).toBe('props.disabled');
  });

  it('should use bracket access for invalid identifiers', () => {
    expect(formatPropAccessor('data-value')).toBe("props['data-value']");
  });
});

describe('buildPropsSection', () => {
  it('should return an empty props block when no props are provided', () => {
    const result = buildPropsSection([]);

    expect(result.lines).toContain('  props: {},');
    expect(result.warnings).toHaveLength(0);
  });
});

describe('wrapGeneratedSection', () => {
  it('should wrap content with default generated section markers', () => {
    const wrapped = wrapGeneratedSection('props: {}');

    expect(wrapped[0]).toContain(GENERATED_SECTION_MARKERS.start);
    expect(wrapped[wrapped.length - 1]).toContain(GENERATED_SECTION_MARKERS.end);
  });
});
